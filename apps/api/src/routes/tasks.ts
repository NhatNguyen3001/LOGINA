import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import {
  ChallengeListDTO,
  JobDTO,
  TasksOverviewDTO,
  TeacherLogicReviewDTO,
  TeacherTaskPreviewDTO,
  TeacherTaskSummaryDTO,
  TryCaseDTO,
} from '@logina/contracts';
import { AppError, decodeNested, lessonsRepo, previewViewsRepo } from '@logina/db';
import { selectChallenge, type RuleBundle } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { requireBaseVersion } from '../middleware/base-version.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { createJob, toJobDTO } from '../services/jobs.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const TASK_TYPES = { Q1: 'JUDGMENT_EVIDENCE', Q2: 'EVIDENCE_RANKING', Q3: 'COMPARE_TRADEOFF', Q4: 'COUNTERARGUMENT', Q5: 'OPEN_PROPOSAL' } as const;
const MAX_EXAMPLES = 3;

/** What a task is waiting on, as a teacher would say it. */
function progressOf(draft: DocumentData | undefined, translation: DocumentData | undefined, uploaded: boolean): TasksOverviewDTO['slots'][number]['progress'] {
  if (!draft) return 'DRAFTING';
  if (draft.status === 'GENERATING') return 'DRAFTING';
  if (draft.status === 'VALIDATING') return 'CHECKING';
  if (draft.status === 'FAILED') return 'FAILED';
  if (!uploaded) return 'READY';
  if (!translation || translation.status === 'WORKING') return 'TRANSLATING';
  return translation.status === 'FAILED' ? 'FAILED' : 'READY';
}
const APPROVABLE = ['MACHINE_PASS', 'REVIEW_REQUIRED'];
/** Fields of a Q2 to Q5 body that only the server may see. */
const SERVER_ONLY_BODY = ['acceptedOrders', 'priorities', 'keywordPartitions'];

export interface LoadedDraft {
  id: string;
  doc: DocumentData;
  report: DocumentData;
  candidates: DocumentData[];
}

export async function loadCurrentDraft(db: Firestore, lesson: DocumentData, slot: string): Promise<LoadedDraft> {
  const id = lesson.currentTaskDraftIds?.[slot] as string | undefined;
  if (!id) throw new AppError('NOT_FOUND', 404, 'Not found.');
  const ref = db.doc(`lessons/${lesson.id as string}/taskDrafts/${id}`);
  const [draft, candidates] = await Promise.all([ref.get(), ref.collection('challengeCandidates').get()]);
  const doc = decodeNested(draft.data()!);
  const report = (await db.doc(`lessons/${lesson.id as string}/validationReports/${doc.latestValidationReportId as string}`).get()).data()!;
  return { id, doc, report, candidates: candidates.docs.map((c) => c.data()) };
}

export const challengePreview = (c: DocumentData) => ({
  label: c.label,
  purpose: c.purposeForTeacher,
  whenShown: c.whenShownForTeacher,
  message: c.message,
});

const gatesOf = (report: DocumentData) =>
  (report.gates as DocumentData[]).map(({ gateId, status, explanationForTeacher }) => ({ gateId, status, explanationForTeacher }));

const exampleChallenges = (candidates: DocumentData[]) =>
  candidates.filter((c) => !c.isNeutralFallback).slice(0, MAX_EXAMPLES).map(challengePreview);

const blockersIn = (report: DocumentData): number => (report.gates as DocumentData[]).filter((g) => g.status === 'BLOCKER').length;

const canApprove = (doc: DocumentData, report: DocumentData): boolean =>
  APPROVABLE.includes(doc.status as string) && blockersIn(report) === 0;

function publicBody(body: DocumentData): DocumentData {
  return Object.fromEntries(Object.entries(body).filter(([key]) => !SERVER_ONLY_BODY.includes(key)));
}

export function taskRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, enqueue } = deps;
  const routes = new Hono<AppEnv>();

  const requireLesson = async (schoolId: string, lessonId: string): Promise<DocumentData> => {
    const lesson = await lessonsRepo.get(db, schoolId, lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return lesson;
  };

  routes.get('/:id/tasks', async (c) => {
    const lessonId = c.req.param('id');
    const lesson = await requireLesson(c.var.user.schoolId, lessonId);
    const rows = (await db.collection(`lessons/${lessonId}/taskSufficiency`).get()).docs.map((d) => d.data());
    const translations = await db.collection(`lessons/${lessonId}/taskTranslations`).get();
    const draftIds = (lesson.currentTaskDraftIds ?? {}) as Record<string, string>;

    const slots = await Promise.all(
      SLOTS.map(async (slot) => {
        const row = rows.find((r) => r.slot === slot);
        const draftId = draftIds[slot];
        const draft = draftId ? (await db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data() : undefined;
        return {
          slot,
          taskType: TASK_TYPES[slot],
          sufficiency: row?.assessment ?? null,
          sufficiencyNote: row?.explanationForTeacher ?? '',
          sourceRefs: row?.sourceRefs ? [row.sourceRefs as string] : [],
          progress: progressOf(draft, translations.docs.find((doc) => doc.id === slot)?.data(), lesson.aiMode === 'LIVE'),
          draftStatus: draft?.status ?? null,
          ...(draftId ? { draftId } : {}),
        };
      }),
    );
    return respond(c, TasksOverviewDTO, { slots });
  });

  routes.get('/:id/tasks/:slot/preview', async (c) => {
    const { schoolId, uid } = c.var.user;
    const lesson = await requireLesson(schoolId, c.req.param('id'));
    const slot = c.req.param('slot');
    const { id, doc, report, candidates } = await loadCurrentDraft(db, lesson, slot);
    await previewViewsRepo.record(db, schoolId, uid, id, report.previewHash as string);

    const shared = {
      draftId: id,
      draftVersion: doc.draftVersion,
      status: doc.status,
      questionStem: doc.questionStem,
      exampleChallenges: exampleChallenges(candidates),
      gates: gatesOf(report),
      blockers: blockersIn(report),
      canApprove: canApprove(doc, report),
    };
    if (slot !== 'Q1') {
      return respond(c, TeacherTaskSummaryDTO, { ...shared, slot, taskType: doc.taskType, taskBody: { ...publicBody(doc.taskBody), teacherLabels: {} } } as never);
    }

    const cards = (await db.collection(`lessons/${lesson.id as string}/taskDrafts/${id}/generatedE`).get()).docs.map((d) => d.data());
    const findingFor = (optionId: string) => {
      const gate = (report.gates as DocumentData[]).find((g) => (g.affectedArtifactIds as string[]).includes(optionId) && g.status !== 'PASS');
      return gate
        ? { inlineFinding: { gateId: gate.gateId, findingCode: gate.findingCodes[0], explanationForTeacher: gate.explanationForTeacher, overridable: gate.overridable } }
        : {};
    };
    return respond(c, TeacherTaskPreviewDTO, {
      ...shared,
      answers: (doc.answerOptions as DocumentData[]).map((a) => ({
        id: a.answerOptionId,
        text: a.text,
        teacherLabel: a.teacherLabel,
        sourceAnchor: a.sourceAnchor,
        ...findingFor(a.answerOptionId as string),
      })),
      evidence: cards.map((e) => ({ id: e.generatedEId, text: e.text, teacherLabel: e.teacherLabel, relationNote: e.relationNote, sourceAnchor: e.sourceAnchor })),
      structureChecks: (report.deterministic as DocumentData[]).map(({ label, status }) => ({ label, status })),
      previewHash: report.previewHash,
      candidateSetVersion: report.candidateSetVersion,
    } as never);
  });

  routes.get('/:id/tasks/:slot/challenges', async (c) => {
    const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id'));
    const slot = c.req.param('slot');
    const { doc, report, candidates } = await loadCurrentDraft(db, lesson, slot);
    return respond(c, ChallengeListDTO, {
      slot,
      draftVersion: doc.draftVersion,
      candidateSetVersion: report.candidateSetVersion,
      challenges: candidates.map((x) => ({ ...challengePreview(x), challengeId: x.challengeId, isFallback: x.isNeutralFallback, sourceAnchor: x.sourceAnchor })),
    } as never);
  });

  routes.get('/:id/tasks/:slot/logic-review', async (c) => {
    const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id'));
    if (c.req.param('slot') !== 'Q1') throw new AppError('NOT_FOUND', 404, 'Not found.');
    const { id, candidates } = await loadCurrentDraft(db, lesson, 'Q1');
    const pairs = (await db.collection(`lessons/${lesson.id as string}/taskDrafts/${id}/pairAlignments`).get()).docs.map((d) => d.data());
    return respond(c, TeacherLogicReviewDTO, {
      pairs: pairs.map((p) => ({
        answerId: p.answerOptionId,
        evidenceId: p.generatedEId,
        relationLabel: p.relationLabel,
        explanation: p.explanationForTeacher,
        goesTo: p.goesToChallengeLabel,
      })),
      challenges: candidates.map((x) => ({ ...challengePreview(x), isFallback: x.isNeutralFallback })),
      boundedEditActions: candidates
        .filter((x) => !x.isNeutralFallback)
        .map((x) => ({ challengeId: x.challengeId, label: x.label, focusOptions: [] })),
      warnings: [],
    } as never);
  });

  routes.post(
    '/:id/tasks/:slot/try-case',
    withIdempotency(db, async (c) => {
      const lesson = await requireLesson(c.var.user.schoolId, c.req.param('id') as string);
      const { answerId, evidenceId } = (await c.req.json()) as { answerId: string; evidenceId: string };
      const { doc, candidates } = await loadCurrentDraft(db, lesson, c.req.param('slot') as string);
      const bundle = (await db.doc(`lessons/${lesson.id as string}/ruleBundles/${doc.ruleBundleId as string}`).get()).data() as RuleBundle;
      const { challengeId } = selectChallenge(bundle, { answerId, evidenceId });
      const chosen = candidates.find((x) => x.challengeId === challengeId)!;
      return respond(c, TryCaseDTO, {
        answerId,
        evidenceId,
        wouldReceive: { label: chosen.label, purpose: chosen.purposeForTeacher, message: chosen.message },
      });
    }),
  );

  routes.post(
    '/:id/tasks/:slot/sufficiency-choice',
    requireBaseVersion(async (c) => (await requireLesson(c.var.user.schoolId, c.req.param('id') as string)).version as number),
    withIdempotency(db, async (c) => {
      const { schoolId } = c.var.user;
      const lessonId = c.req.param('id') as string;
      const slot = c.req.param('slot') as string;
      const { choice } = (await c.req.json()) as { choice: string };
      const regenerates = choice === 'REFOCUS';
      const job = await createJob(db, { schoolId, lessonId, type: 'GENERATE', targetIds: [slot] });
      const batch = db.batch();
      batch.set(db.doc(`lessons/${lessonId}/taskSufficiency/${slot}`), { slot, teacherChoice: choice }, { merge: true });
      batch.update(db.doc(`lessons/${lessonId}`), { version: FieldValue.increment(1), ...(regenerates ? { activeJobId: job.id } : {}) });
      /** Only Refocus has work to do; any other choice must not leave a job that never runs. */
      if (!regenerates) batch.update(db.doc(`jobs/${job.id}`), { status: 'DONE' });
      await batch.commit();
      if (regenerates) await enqueue({ jobId: job.id, type: 'GENERATE', lessonId, targetIds: [slot] });
      return respond(c, JobDTO, toJobDTO({ ...job, ...(regenerates ? {} : { status: 'DONE' }) }));
    }),
  );

  return routes;
}
