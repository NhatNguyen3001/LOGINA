import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { ApproveReq, ApproveResultDTO, DispositionReq, JobDTO, TaskApprovalDTO, TranslationEditReq } from '@logina/contracts';
import { AppError, auditRepo, decodeNested, encodeNested, lessonsRepo, newId, previewViewsRepo, writeOnce } from '@logina/db';
import { assignRuntimeIds, checkApproval, type QualityGate, shuffleAvoiding } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { requireBaseVersion } from '../middleware/base-version.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { createJob, toJobDTO } from '../services/jobs.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const SERVER_ONLY_BODY = ['acceptedOrders', 'priorities', 'keywordPartitions'];

const iso = (value: { toDate: () => Date } | undefined): string | undefined => value?.toDate().toISOString();

const publicBody = (body: DocumentData | undefined): DocumentData | undefined =>
  body && Object.fromEntries(Object.entries(body).filter(([key]) => !SERVER_ONLY_BODY.includes(key)));

/** What students get: no server-only keys, and Q2 cards out of their accepted order. */
function studentBody(releaseId: string, body: DocumentData): DocumentData | undefined {
  const visible = publicBody(body);
  if (!visible?.cards) return visible;
  const cards = visible.cards as { cardId: string }[];
  const accepted = ((body.acceptedOrders ?? []) as (string[] | { order: string[] })[]).map((order) => (Array.isArray(order) ? order : order.order));
  const order = shuffleAvoiding(releaseId, cards.map((card) => card.cardId), [...accepted, cards.map((card) => card.cardId)]);
  return { ...visible, cards: order.map((id) => cards.find((card) => card.cardId === id)) };
}

async function buildRelease(db: Firestore, lessonId: string, draftId: string, draft: DocumentData, report: DocumentData, releaseId: string) {
  const draftRef = db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`);
  const [cards, candidates] = await Promise.all([draftRef.collection('generatedE').get(), draftRef.collection('challengeCandidates').get()]);
  const evidence = cards.docs.map((doc) => doc.data());
  const runtime = assignRuntimeIds(
    releaseId,
    report.contentManifestHash as string,
    (draft.answerOptions ?? []) as { answerOptionId: string }[],
    evidence as { generatedEId: string }[],
    draft.displayOrder as { answers: string[]; evidence: string[] } | undefined,
  );
  const textOf = (list: DocumentData[], key: string, id: string): string => list.find((item) => item[key] === id)?.text as string;

  return {
    publicContent: {
      questionStem: draft.questionStem,
      answerOptions: runtime.answers.map(({ runtimeId, answerOptionId }) => ({ id: runtimeId, text: textOf((draft.answerOptions ?? []) as DocumentData[], 'answerOptionId', answerOptionId) })),
      evidenceOptions: runtime.evidence.map(({ runtimeId, generatedEId }) => ({ evidenceId: runtimeId, text: textOf(evidence, 'generatedEId', generatedEId) })),
      ...(draft.taskBody ? { taskBody: encodeNested(studentBody(releaseId, draft.taskBody as DocumentData)) } : {}),
    },
    answerIdMap: Object.fromEntries(runtime.answers.map((a) => [a.runtimeId, a.answerOptionId])),
    evidenceIdMap: Object.fromEntries(runtime.evidence.map((e) => [e.runtimeId, e.generatedEId])),
    teacherContent: {
      answers: draft.answerOptions ?? [],
      evidence,
      pairs: (await draftRef.collection('pairAlignments').get()).docs.map((doc) => doc.data()),
      candidates: candidates.docs.map((doc) => doc.data()),
    },
    feedbackContent: draft.feedback ?? [],
    ...(draft.taskBody ? { serverBody: encodeNested(draft.taskBody) } : {}),
  };
}

const isAccepted = (finding: DocumentData, dispositions: DocumentData[]): boolean =>
  dispositions.some((d) => d.gateId === 'TRANSLATION' && d.findingCode === finding.findingCode && d.decision === 'TEACHER_ACCEPT_WITH_REASON');

const STUCK_MS = 45 * 60 * 1000;

const isStuck = (translation: DocumentData): boolean =>
  translation.status === 'WORKING' && Date.now() - ((translation.updatedAt as { toDate: () => Date } | undefined)?.toDate().getTime() ?? 0) > STUCK_MS;

/** Stops approval unless the teacher can stand behind both languages. */
function checkTranslation(translation: DocumentData | undefined, draftId: string, dispositions: DocumentData[], expectedVersion: number | undefined): void {
  if (!translation || translation.draftId !== draftId || ['WORKING', 'BLOCKED', 'FAILED'].includes(translation.status as string)) {
    throw new AppError('TRANSLATION_NOT_READY', 409, 'The translation is not ready to approve.');
  }
  if (expectedVersion !== translation.version) throw new AppError('STALE_VERSION', 409, 'This translation changed.');
  const open = (translation.findings as DocumentData[]).filter((finding) => !isAccepted(finding, dispositions));
  if (open.length > 0) throw new AppError('UNDISPOSITIONED_REVIEW', 409, 'A translation finding needs a decision.');
}

const mergeKeywords = (body: DocumentData, keywords: Record<string, string[]>): DocumentData => ({
  ...body,
  keywordPartitions: Object.fromEntries(
    Object.entries((body.keywordPartitions ?? {}) as Record<string, string[]>).map(([name, words]) => [name, [...new Set([...words, ...(keywords[name] ?? [])])]]),
  ),
});

export function approvalRoutes({ db, enqueue }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string): Promise<DocumentData> => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };

  const loadTask = async (lesson: DocumentData, slot: string) => {
    const lessonId = lesson.id as string;
    const draftId = lesson.currentTaskDraftIds?.[slot] as string | undefined;
    if (!draftId) throw new AppError('TASKS_NOT_READY', 409, 'Every task needs a draft first.');
    const draft = decodeNested((await db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()!);
    const report = (await db.doc(`lessons/${lessonId}/validationReports/${draft.latestValidationReportId as string}`).get()).data()!;
    const dispositions = (await db.collection(`lessons/${lessonId}/dispositions`).where('validationReportId', '==', draft.latestValidationReportId).get()).docs.map((d) => d.data());
    const translation = (await db.doc(`lessons/${lessonId}/taskTranslations/${slot}`).get()).data();
    return { draftId, draft, report, dispositions, translation };
  };

  const requireUpload = (lesson: DocumentData): void => {
    if (lesson.aiMode !== 'LIVE') throw new AppError('NOT_AN_UPLOAD', 409, 'The sample lesson has its own translation.');
  };

  const startTranslate = async (lesson: DocumentData, slot: string, fresh: boolean) => {
    const job = await createJob(db, { schoolId: lesson.schoolId as string, lessonId: lesson.id as string, type: 'TRANSLATE', targetIds: [slot] });
    await db.doc(`jobs/${job.id}`).update({ fresh });
    await enqueue({ jobId: job.id, type: 'TRANSLATE', lessonId: lesson.id as string, targetIds: [slot] }).catch(async (error: unknown) => {
      await db.doc(`lessons/${lesson.id as string}/taskTranslations/${slot}`).update({ status: 'FAILED', version: FieldValue.increment(1) });
      throw error;
    });
    return job;
  };

  const draftVersion = requireBaseVersion(async (c) => {
    const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
    const { draft } = await loadTask(lesson, c.req.param('slot') as string);
    return draft.draftVersion as number;
  });

  routes.get('/:id/approval', async (c) => {
    const { schoolId, uid } = c.var.user;
    const lesson = await requireLesson(schoolId, c.req.param('id'));
    const lessonId = lesson.id as string;
    const releases = (await db.collection(`lessons/${lessonId}/taskReleases`).get()).docs.map((d) => d.data());

    const tasks = await Promise.all(
      SLOTS.map(async (slot) => {
        const { draftId, draft, report, dispositions, translation } = await loadTask(lesson, slot);
        const release = releases.find((r) => r.taskDraftId === draftId);
        const seen = await previewViewsRepo.get(db, schoolId, uid, draftId);
        const accepted = dispositions.filter((d) => d.decision === 'TEACHER_ACCEPT_WITH_REASON');
        return {
          slot,
          status: draft.status,
          gatesSummary: {
            aggregate: report.aggregate,
            gates: (report.gates as DocumentData[]).map(({ gateId, status, explanationForTeacher }) => ({ gateId, status, explanationForTeacher })),
          },
          draftVersion: draft.draftVersion,
          previewHash: report.previewHash,
          candidateSetVersion: report.candidateSetVersion,
          missingAltTextRefs: [],
          changesSinceLastPreview: seen && seen.previewHash !== report.previewHash ? ['PREVIEW_CHANGED'] : [],
          decisionsNeeded: (report.gates as DocumentData[])
            .filter((g) => g.status === 'REVIEW_REQUIRED')
            .flatMap((g) =>
              (g.findingCodes as string[])
                .filter((code) => !accepted.some((d) => d.gateId === g.gateId && d.findingCode === code))
                .map((findingCode) => ({ gateId: g.gateId, findingCode, explanationForTeacher: g.explanationForTeacher, overridable: g.overridable })),
            )
            .concat(
              ((translation?.findings ?? []) as DocumentData[])
                .filter((finding) => finding.status === 'REVIEW_REQUIRED' && !isAccepted(finding, dispositions))
                .map((finding) => ({ gateId: 'TRANSLATION', findingCode: finding.findingCode, explanationForTeacher: finding.explanationForTeacher, overridable: true })),
            ),
          acceptedWarning: accepted.length > 0,
          ...(release ? { releaseLabel: release.releaseLabel, approvedAt: iso(release.approvedAt) } : {}),
          ...(translation ? { translation: { status: translation.status, stuck: isStuck(translation), locale: translation.locale, version: translation.version, texts: translation.texts, keywords: translation.keywords, findings: translation.findings } } : {}),
        };
      }),
    );
    return respond(c, TaskApprovalDTO, {
      tasks,
      contentManifestHash: '',
      canApprove: tasks.every((t) => t.status === 'MACHINE_PASS' || t.status === 'REVIEW_REQUIRED' || t.status === 'APPROVED'),
    } as never);
  });

  routes.post(
    '/:id/tasks/:slot/dispositions',
    draftVersion,
    withIdempotency(db, async (c) => {
      const { schoolId, uid } = c.var.user;
      const lesson = await requireLesson(schoolId, c.req.param('id') as string);
      const req = DispositionReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const { draft } = await loadTask(lesson, c.req.param('slot') as string);
      const { baseVersion: _baseVersion, ...decision } = req.data;
      await db.doc(`lessons/${lesson.id as string}/dispositions/${newId('dsp')}`).create({
        ...decision,
        validationReportId: draft.latestValidationReportId,
        actor: uid,
        at: FieldValue.serverTimestamp(),
      });
      return c.json({ ok: true });
    }),
  );

  routes.post(
    '/:id/tasks/:slot/approve',
    withIdempotency(db, async (c) => {
      const { schoolId, uid } = c.var.user;
      const lesson = await requireLesson(schoolId, c.req.param('id') as string);
      const lessonId = lesson.id as string;
      const slot = c.req.param('slot') as string;
      const req = ApproveReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');

      const { draftId, draft, report, dispositions, translation } = await loadTask(lesson, slot);
      const uploaded = lesson.aiMode === 'LIVE';
      if (uploaded) checkTranslation(translation, draftId, dispositions, req.data.translationVersion);
      const verdict = checkApproval({
        draft: { draftVersion: draft.draftVersion as number, status: draft.status, sourceModelVersionId: draft.sourceModelVersionId as string },
        expectedDraftVersion: req.data.expectedDraftVersion,
        report: { aggregate: report.aggregate, previewHash: report.previewHash, candidateSetVersion: req.data.candidateSetVersion, gates: report.gates as QualityGate[] },
        submittedPreviewHash: req.data.previewHash,
        latestCandidateSetVersion: report.candidateSetVersion as number,
        dispositions: dispositions as never,
        sourceApproved: Boolean(lesson.currentSourceModelVersionId),
        actorIsEditor: (lesson.editorTeacherIds as string[]).includes(uid),
        confirmed: req.data.confirmed,
        missingAltTextRefs: [],
      });
      if (!verdict.ok) throw new AppError(verdict.reasons[0]!, 409, 'This task cannot be approved yet.', verdict.reasons);

      const releaseId = `rel_${draftId}`;
      const releaseLabel = `r${draft.draftVersion as number}`;
      const built = await buildRelease(db, lessonId, draftId, draft, report, releaseId);
      const content = uploaded && translation
        ? {
            ...built,
            translations: { [translation.locale as string]: translation.texts },
            ...(draft.taskBody ? { serverBody: encodeNested(mergeKeywords(draft.taskBody as DocumentData, translation.keywords as Record<string, string[]>)) } : {}),
          }
        : built;
      await db.runTransaction(async (tx) => {
        const live = (await tx.get(db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`))).data();
        if (live?.status !== draft.status) throw new AppError('STALE_VERSION', 409, 'This task changed.');
        if (uploaded) checkTranslation((await tx.get(db.doc(`lessons/${lessonId}/taskTranslations/${slot}`))).data(), draftId, dispositions, req.data.translationVersion);
        writeOnce(tx, db.doc(`lessons/${lessonId}/taskReleases/${releaseId}`), {
          ...content,
          lessonId,
          slot,
          taskDraftId: draftId,
          draftVersion: draft.draftVersion,
          releaseLabel,
          ruleBundleId: draft.ruleBundleId,
          ruleBundleHash: report.ruleBundleHash,
          contentManifestHash: report.contentManifestHash,
          previewHash: report.previewHash,
          candidateSetVersion: report.candidateSetVersion,
          dependencyManifest: draft.dependencyManifest,
          approvedBy: uid,
          approvedAt: FieldValue.serverTimestamp(),
          status: 'ACTIVE',
        });
        tx.update(db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`), { status: 'APPROVED' });
        tx.update(db.doc(`lessons/${lessonId}`), { stage: 'APPROVE_ASSIGN', updatedAt: FieldValue.serverTimestamp() });
        auditRepo.append(db, tx, newId('evt'), {
          schoolId,
          lessonId,
          actor: uid,
          action: 'TASK_APPROVED',
          targetType: 'taskDraft',
          targetId: draftId,
          hashes: { contentManifestHash: report.contentManifestHash, previewHash: report.previewHash },
        });
      });
      return respond(c, ApproveResultDTO, { taskReleaseId: releaseId, releaseLabel });
    }),
  );

  routes.post(
    '/:id/tasks/:slot/translation',
    withIdempotency(db, async (c) => {
      const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
      requireUpload(lesson);
      const slot = c.req.param('slot') as string;
      const req = TranslationEditReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const ref = db.doc(`lessons/${lesson.id as string}/taskTranslations/${slot}`);
      const translation = (await ref.get()).data();
      if (!translation) throw new AppError('NOT_FOUND', 404, 'Not found.');
      if (translation.status === 'WORKING') throw new AppError('JOB_RUNNING', 409, 'This translation is being worked on.');
      if (translation.version !== req.data.translationVersion) throw new AppError('STALE_VERSION', 409, 'This translation changed.');
      if (!(translation.texts as DocumentData[]).some((pair) => pair.from === req.data.from)) throw new AppError('NOT_FOUND', 404, 'Not found.');
      const texts = (translation.texts as DocumentData[]).map((pair) => (pair.from === req.data.from ? { from: pair.from, to: req.data.to } : pair));
      await ref.update({ texts, status: 'WORKING', version: FieldValue.increment(1) });
      return respond(c, JobDTO, toJobDTO(await startTranslate(lesson, slot, false)));
    }),
  );

  routes.post(
    '/:id/tasks/:slot/translation/retry',
    withIdempotency(db, async (c) => {
      const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
      requireUpload(lesson);
      const slot = c.req.param('slot') as string;
      const ref = db.doc(`lessons/${lesson.id as string}/taskTranslations/${slot}`);
      const translation = (await ref.get()).data();
      const blocked = translation?.status === 'BLOCKED';
      if (translation && translation.status !== 'FAILED' && !blocked && !isStuck(translation)) throw new AppError('TRANSLATION_NOT_RETRYABLE', 409, 'This translation does not need a retry.');
      await ref.set({ slot, status: 'WORKING', version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return respond(c, JobDTO, toJobDTO(await startTranslate(lesson, slot, blocked)));
    }),
  );

  return routes;
}
