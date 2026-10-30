import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { EditReq, EditResultDTO, JobDTO, SourceDraftDTO } from '@logina/contracts';
import { AppError, decodeNested, encodeNested, lessonsRepo, newId } from '@logina/db';
import { dependencyClosure, detectNewFacts, type ClosureDraft } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { createJob, toJobDTO } from '../services/jobs.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const CHILDREN = ['generatedE', 'pairAlignments', 'challengeCandidates'] as const;

const nextDraftId = (lessonId: string, slot: string, version: number): string => `tdr_${lessonId}_${slot}_v${version}`;

/** Every approved source text a Quick edit may draw on. */
async function sourceTexts(db: Firestore, lessonId: string): Promise<string[]> {
  const units = await db.collection(`lessons/${lessonId}/sourceUnits`).get();
  return units.docs.map((doc) => doc.data().text as string);
}

async function currentDrafts(db: Firestore, lesson: DocumentData): Promise<(ClosureDraft & { status: string })[]> {
  const ids = Object.values((lesson.currentTaskDraftIds ?? {}) as Record<string, string>);
  const docs = await Promise.all(ids.map((id) => db.doc(`lessons/${lesson.id as string}/taskDrafts/${id}`).get()));
  return docs.map((doc) => {
    const data = doc.data()!;
    return { taskDraftId: doc.id, slot: data.slot, manifest: data.dependencyManifest, status: data.status };
  });
}

export function editRoutes({ db, enqueue }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string): Promise<DocumentData> => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };

  const sourceEdit = async (lesson: DocumentData, req: EditReq & { editScope: 'SOURCE' }, uid: string) => {
    const lessonId = lesson.id as string;
    if (req.baseVersion !== ((lesson.sourceVersion as number | undefined) ?? 1)) {
      throw new AppError('VERSION_CONFLICT', 409, 'A newer version exists.');
    }
    const claim = (await db.doc(`lessons/${lessonId}/sourceClaims/${req.payload.claimId}`).get()).data();
    if (!claim) throw new AppError('NOT_FOUND', 404, 'Not found.');

    const drafts = await currentDrafts(db, lesson);
    const { affectedDraftIds } = dependencyClosure([req.payload.claimId, ...req.payload.evidenceIds], drafts);
    const editId = newId('edt');
    const job = await createJob(db, { schoolId: lesson.schoolId as string, lessonId, type: 'GENERATE', targetIds: [] });

    const batch = db.batch();
    batch.set(db.doc(`lessons/${lessonId}/edits/${editId}`), {
      editScope: 'SOURCE',
      targetType: req.targetType,
      targetId: req.targetId,
      changedRefs: req.changedRefs,
      payload: req.payload,
      baseVersion: req.baseVersion,
      staleMarkedIds: affectedDraftIds,
      actor: uid,
      at: FieldValue.serverTimestamp(),
    });
    for (const id of affectedDraftIds) batch.update(db.doc(`lessons/${lessonId}/taskDrafts/${id}`), { status: 'STALE' });
    batch.set(db.doc(`lessons/${lessonId}/sourceDrafts/current`), {
      claimId: req.payload.claimId,
      before: claim.wording,
      after: req.payload.wording,
      evidenceIds: req.payload.evidenceIds,
      affectedDraftIds,
    });
    batch.update(db.doc(`lessons/${lessonId}`), { stage: 'SOURCE_REVIEW', sourceVersion: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
    return { editId, newDraftIds: [], staleDraftIds: affectedDraftIds, jobId: job.id };
  };

  const draftEdit = async (lesson: DocumentData, req: EditReq & { editScope: 'CONTENT' | 'LOGIC' }, uid: string) => {
    const lessonId = lesson.id as string;
    const lessonRef = db.doc(`lessons/${lessonId}`);
    const draftRef = db.doc(`lessons/${lessonId}/taskDrafts/${req.targetId}`);
    const draft = (await draftRef.get()).data();
    if (!draft) throw new AppError('NOT_FOUND', 404, 'Not found.');

    if (req.editScope === 'CONTENT') {
      const added = detectNewFacts(req.payload.text, await sourceTexts(db, lessonId));
      if (added.length > 0) throw new AppError('NEEDS_SOURCE_ROUTE', 422, 'Quick edit is for wording only.', [req.payload.optionId]);
    }

    const children = await Promise.all(CHILDREN.map((name) => draftRef.collection(name).get()));
    const version = (draft.draftVersion as number) + 1;
    const newDraftId = nextDraftId(lessonId, draft.slot as string, version);
    const newRef = db.doc(`lessons/${lessonId}/taskDrafts/${newDraftId}`);
    const job = await createJob(db, { schoolId: lesson.schoolId as string, lessonId, type: 'RERUN', targetIds: [newDraftId] });
    const editId = newId('edt');

    const changed = decodeNested(draft);
    if (req.editScope === 'CONTENT') {
      changed.answerOptions = (changed.answerOptions as DocumentData[]).map((option) =>
        option.answerOptionId === req.payload.optionId ? { ...option, text: req.payload.text } : option,
      );
    }

    await db.runTransaction(async (tx) => {
      const live = (await tx.get(draftRef)).data();
      if (live?.draftVersion !== req.baseVersion || (await tx.get(newRef)).exists) {
        throw new AppError('VERSION_CONFLICT', 409, 'A newer version exists.');
      }
      tx.update(draftRef, { status: 'STALE' });
      tx.create(newRef, { ...encodeNested(changed), draftVersion: version, status: 'VALIDATING', parentDraftId: req.targetId, createdBy: uid, createdFromEditId: editId });
      CHILDREN.forEach((name, i) => {
        for (const doc of children[i]!.docs) {
          const isEdited = name === 'challengeCandidates' && req.editScope === 'LOGIC' && doc.id === req.payload.challengeId && req.payload.message;
          tx.set(newRef.collection(name).doc(doc.id), isEdited ? { ...doc.data(), message: req.payload.message } : doc.data());
        }
      });
      tx.set(db.doc(`lessons/${lessonId}/edits/${editId}`), {
        editScope: req.editScope,
        targetType: req.targetType,
        targetId: req.targetId,
        changedRefs: req.changedRefs,
        payload: req.payload,
        baseVersion: req.baseVersion,
        resultDraftId: newDraftId,
        staleMarkedIds: [req.targetId],
        actor: uid,
        at: FieldValue.serverTimestamp(),
      });
      tx.update(lessonRef, {
        [`currentTaskDraftIds.${draft.slot as string}`]: newDraftId,
        activeJobId: job.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await db.doc(`jobs/${job.id}`).update({ edit: { editScope: req.editScope, payload: req.payload } });
    await enqueue({ jobId: job.id, type: 'RERUN', lessonId, targetIds: [newDraftId] });
    return { editId, newDraftIds: [newDraftId], staleDraftIds: [req.targetId], jobId: job.id };
  };

  routes.post(
    '/:id/edits',
    withIdempotency(db, async (c) => {
      const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
      const body = (await c.req.json()) as { baseVersion?: unknown };
      if (typeof body.baseVersion !== 'number') throw new AppError('BASE_VERSION_REQUIRED', 400, 'baseVersion is required.');
      const req = EditReq.safeParse(body);
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const { uid } = c.var.user;
      const result =
        req.data.editScope === 'SOURCE' ? await sourceEdit(lesson, req.data, uid) : await draftEdit(lesson, req.data, uid);
      return respond(c, EditResultDTO, result);
    }),
  );

  routes.post(
    '/:id/tasks/:slot/rerun',
    withIdempotency(db, async (c) => {
      const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
      const lessonId = lesson.id as string;
      const draftId = lesson.currentTaskDraftIds?.[c.req.param('slot') as string] as string | undefined;
      const draftRef = db.doc(`lessons/${lessonId}/taskDrafts/${draftId ?? 'none'}`);
      const draft = (await draftRef.get()).data();
      if (!draft) throw new AppError('NOT_FOUND', 404, 'Not found.');
      if (draft.status !== 'FAILED') throw new AppError('NOT_FAILED', 409, 'Only a failed recheck can be retried.');

      const job = await createJob(db, { schoolId: lesson.schoolId as string, lessonId, type: 'RERUN', targetIds: [draftId as string] });
      await draftRef.update({ status: 'VALIDATING' });
      await db.doc(`lessons/${lessonId}`).update({ activeJobId: job.id });
      await enqueue({ jobId: job.id, type: 'RERUN', lessonId, targetIds: [draftId as string] });
      return respond(c, JobDTO, toJobDTO(job));
    }),
  );

  routes.get('/:id/source-draft', async (c) => {
    const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id'));
    const lessonId = lesson.id as string;
    const draft = (await db.doc(`lessons/${lessonId}/sourceDrafts/current`).get()).data();
    if (!draft) throw new AppError('NOT_FOUND', 404, 'Not found.');

    const drafts = await currentDrafts(db, lesson);
    const affected = draft.affectedDraftIds as string[];
    const isAffected = (slot: string) => drafts.some((d) => d.slot === slot && affected.includes(d.taskDraftId));
    const evidence = await Promise.all((draft.evidenceIds as string[]).map((id) => db.doc(`lessons/${lessonId}/sourceEvidence/${id}`).get()));

    return respond(c, SourceDraftDTO, {
      sourceModelDraftId: `smd_${lessonId}`,
      version: (lesson.sourceVersion as number | undefined) ?? 1,
      editedClaims: [{ claimId: draft.claimId, before: draft.before, after: draft.after, evidence: evidence.map((e) => e.data()?.text ?? '').join(' ') }],
      impact: drafts.map((d) => ({ slot: d.slot, usesClaim: isAffected(d.slot), refs: d.manifest.sourceClaimIds })),
      unaffectedSlots: SLOTS.filter((slot) => drafts.some((d) => d.slot === slot) && !isAffected(slot)),
      assignedReleasesUnchanged: [],
      approveReady: true,
    });
  });

  return routes;
}
