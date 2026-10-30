import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { ResolveIssueReq, SourceApprovalResultDTO, SourceReviewDTO } from '@logina/contracts';
import { canonicalHash } from '@logina/domain';
import { AppError, decodeNested, lessonsRepo, newId } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { requireBaseVersion } from '../middleware/base-version.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { createJob } from '../services/jobs.js';

const STATE_FOR = {
  CONFIRM: 'CONFIRMED',
  USE_SUGGESTION: 'SUGGESTION_ACCEPTED',
  EDIT: 'EDITED',
  KEEP_OPEN: 'KEEP_OPEN',
  EXCLUDE: 'EXCLUDED',
  REOPEN: 'UNRESOLVED',
} as const;

const SAVED_AS = { EDIT: 'TEACHER_INTERPRETATION', KEEP_OPEN: 'TASK_ASSUMPTION' } as const;

const isOpenBlocker = (issue: DocumentData): boolean => issue.severity === 'BLOCKER' && issue.state === 'UNRESOLVED';
const iso = (value: { toDate: () => Date } | undefined): string | undefined => value?.toDate().toISOString();

async function readSource(db: Firestore, lessonId: string) {
  const read = async (name: string): Promise<DocumentData[]> =>
    (await db.collection(`lessons/${lessonId}/${name}`).get()).docs.map((doc) => ({ id: doc.id, ...decodeNested(doc.data()) }));
  const [units, evidence, claims, relations, issues] = await Promise.all([
    read('sourceUnits'),
    read('sourceEvidence'),
    read('sourceClaims'),
    read('claimEvidenceRelations'),
    read('clarificationIssues'),
  ]);
  return { units, evidence, claims, relations, issues: issues.sort((a, b) => a.pointNumber - b.pointNumber) };
}

const missingAltText = (units: DocumentData[]): string[] =>
  units.filter((unit) => unit.figure && !unit.figure.altText).map((unit) => unit.id as string);

const unlocatedClaims = (claims: DocumentData[], evidence: DocumentData[]): string[] =>
  claims
    .filter((claim) => {
      const own = evidence.filter((e) => (claim.sourceEvidenceIds as string[]).includes(e.id as string));
      return own.length === 0 || own.some((e) => !e.locator);
    })
    .map((claim) => claim.id as string);

export function sourceRoutes({ db, enqueue }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string): Promise<DocumentData> => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };
  const sourceVersion = requireBaseVersion(
    async (c) => ((await requireLesson(c.var.user.schoolId, c.req.param('id') as string)).sourceVersion as number | undefined) ?? 1,
  );

  routes.get('/:id/source-review', async (c) => {
    const lessonId = c.req.param('id');
    const lesson = await requireLesson(c.var.user.schoolId, lessonId);
    const { units, evidence, claims, issues } = await readSource(db, lessonId);
    const materialVersionId = lesson.currentMaterialVersionId as string;
    const material = (await db.doc(`lessons/${lessonId}/materialVersions/${materialVersionId}`).get()).data()!;
    const blockersRemaining = issues.filter(isOpenBlocker).length;

    return respond(c, SourceReviewDTO, {
      sourceModelDraftId: `smd_${lessonId}`,
      version: (lesson.sourceVersion as number | undefined) ?? 1,
      approvedSourceVersion: (lesson.approvedSourceVersion as number | undefined) ?? null,
      readByAI: lesson.aiMode === 'LIVE',
      summaryClaims: claims.map((claim) => {
        const first = evidence.find((e) => (claim.sourceEvidenceIds as string[]).includes(e.id as string));
        return {
          id: claim.id,
          wording: claim.wording,
          evidenceSnippet: first?.text ?? '',
          locator: first?.locator ?? '',
          status: claim.acceptedStatus,
        };
      }),
      teacherDecisions: issues
        .filter((i) => i.questionKind === 'TEACHER_INTENT' && i.state !== 'UNRESOLVED')
        .map((i) => ({ issueId: i.id, label: 'GOAL', text: i.resolution?.text ?? i.currentInterpretation, note: '' })),
      openGaps: issues
        .filter((i) => i.state === 'KEEP_OPEN')
        .map((i) => ({ issueId: i.id, reason: i.resolution?.keepOpenReason ?? '', bounds: i.resolution?.keepOpenBounds ?? '' })),
      excluded: issues
        .filter((i) => i.state === 'EXCLUDED')
        .map((i) => ({ issueId: i.id, text: i.bubble, reason: i.resolution?.excludeReason ?? i.excludeReason ?? '' })),
      material: {
        materialVersionId,
        fileName: material.fileName,
        mimeType: material.mimeType,
        unitKind: material.unitKind,
        title: material.title,
        locator: material.locator ?? '',
        paragraphs: units.map((unit) => ({ id: unit.id, page: unit.span.page, text: unit.text, readBy: unit.readBy })),
      },
      issues: issues.map((issue) => ({
        id: issue.id,
        pointNumber: issue.pointNumber,
        issueType: issue.issueType,
        severity: issue.severity,
        bubble: issue.bubble,
        currentInterpretation: issue.currentInterpretation,
        suggestions: issue.suggestions.map(({ id, text, sourceRef }: DocumentData) => ({ id, text, sourceRef })),
        state: issue.state,
        spans: issue.spans,
        ...(issue.resolution
          ? {
              resolution: {
                action: issue.resolution.action,
                ...(issue.resolution.text ? { text: issue.resolution.text } : {}),
                savedAs: issue.resolution.savedAs ?? null,
              },
              resolvedBy: issue.resolvedBy,
              resolvedAt: iso(issue.resolvedAt),
            }
          : {}),
      })),
      approveReady: blockersRemaining === 0 && missingAltText(units).length === 0 && unlocatedClaims(claims, evidence).length === 0,
      blockersRemaining,
    });
  });

  routes.post(
    '/:id/issues/:issueId/resolve',
    sourceVersion,
    withIdempotency(db, async (c) => {
      const lessonId = c.req.param('id') as string;
      const { uid } = c.var.user;
      const req = ResolveIssueReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      const { baseVersion: _baseVersion, ...decision } = req.data;
      const issueRef = db.doc(`lessons/${lessonId}/clarificationIssues/${c.req.param('issueId') as string}`);
      const issue = (await issueRef.get()).data();
      if (!issue) throw new AppError('NOT_FOUND', 404, 'Not found.');

      const toState = STATE_FOR[decision.action];
      const teacher = (await db.doc(`users/${uid}`).get()).data();
      const suggestion =
        decision.action === 'USE_SUGGESTION'
          ? (issue.suggestions as DocumentData[]).find((s) => s.id === decision.suggestionId)
          : undefined;
      if (decision.action === 'USE_SUGGESTION' && !suggestion) throw new AppError('NOT_FOUND', 404, 'Not found.');

      const batch = db.batch();
      batch.update(
        issueRef,
        decision.action === 'REOPEN'
          ? {
              state: toState,
              version: FieldValue.increment(1),
              resolution: FieldValue.delete(),
              resolvedBy: FieldValue.delete(),
              resolvedAt: FieldValue.delete(),
            }
          : {
              state: toState,
              resolution: {
                ...decision,
                ...(suggestion ? { text: suggestion.text } : {}),
                savedAs: SAVED_AS[decision.action as keyof typeof SAVED_AS] ?? null,
              },
              resolvedBy: teacher?.displayName ?? '',
              resolvedAt: FieldValue.serverTimestamp(),
            },
      );
      batch.create(issueRef.collection('history').doc(newId('evt')), {
        fromState: issue.state,
        toState,
        actor: uid,
        at: FieldValue.serverTimestamp(),
        payload: decision,
      });
      batch.update(db.doc(`lessons/${lessonId}`), { sourceVersion: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      return c.json({ ok: true });
    }),
  );

  routes.post(
    '/:id/source-approval',
    sourceVersion,
    withIdempotency(db, async (c) => {
      const lessonId = c.req.param('id') as string;
      const { schoolId, uid } = c.var.user;
      const lesson = await requireLesson(schoolId, lessonId);
      const { units, evidence, claims, relations, issues } = await readSource(db, lessonId);

      const altText = missingAltText(units);
      if (altText.length > 0) throw new AppError('MISSING_ALT_TEXT', 409, 'Add a text description first.', altText);
      if (issues.some(isOpenBlocker)) throw new AppError('BLOCKERS_REMAIN', 409, 'Resolve every blocker first.');
      const unlocated = unlocatedClaims(claims, evidence);
      if (unlocated.length > 0) throw new AppError('CLAIM_WITHOUT_LOCATOR', 409, 'Every claim needs a location.', unlocated);

      const sourceDraftRef = db.doc(`lessons/${lessonId}/sourceDrafts/current`);
      const sourceDraft = (await sourceDraftRef.get()).data();
      if (sourceDraft) {
        const claim = claims.find((x) => x.id === sourceDraft.claimId);
        if (claim) claim.wording = sourceDraft.after;
      }
      const version = ((lesson.approvedSourceVersion as number | undefined) ?? 0) + 1;
      const snapshot = {
        version,
        status: 'APPROVED',
        materialVersionIds: [lesson.currentMaterialVersionId],
        intentVersionId: lesson.currentIntentVersionId,
        approvedUnitIds: units.map((u) => u.id),
        sourceEvidenceIds: evidence.map((e) => e.id),
        sourceClaimIds: claims.map((x) => x.id),
        relationIds: relations.map((r) => r.id),
        openGaps: issues
          .filter((i) => i.state === 'KEEP_OPEN')
          .map((i) => ({ issueId: i.id, bounds: i.resolution.keepOpenBounds, reason: i.resolution.keepOpenReason })),
        excludedIds: issues.filter((i) => i.state === 'EXCLUDED').map((i) => i.id),
      };
      const sourceModelVersionId = newId('smv');
      const affectedSlots = (sourceDraft?.affectedDraftIds as string[] | undefined)?.map((id) => /_(Q[1-5])_v/.exec(id)?.[1] as string) ?? [];
      const job = await createJob(db, { schoolId, lessonId, type: 'GENERATE', targetIds: affectedSlots });

      const batch = db.batch();
      batch.create(db.doc(`lessons/${lessonId}/sourceModelVersions/${sourceModelVersionId}`), {
        ...snapshot,
        contentHash: canonicalHash(snapshot),
        approvedBy: uid,
        approvedAt: FieldValue.serverTimestamp(),
      });
      batch.update(db.doc(`lessons/${lessonId}`), {
        stage: 'GENERATE_PREVIEW',
        currentSourceModelVersionId: sourceModelVersionId,
        approvedSourceVersion: version,
        activeJobId: job.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (sourceDraft) {
        batch.update(db.doc(`lessons/${lessonId}/sourceClaims/${sourceDraft.claimId as string}`), { wording: sourceDraft.after });
        batch.delete(sourceDraftRef);
      }
      await batch.commit();
      await enqueue({ jobId: job.id, type: 'GENERATE', lessonId, targetIds: affectedSlots });
      return respond(c, SourceApprovalResultDTO, { sourceModelVersionId, version, jobId: job.id });
    }),
  );

  return routes;
}
