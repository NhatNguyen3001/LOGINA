import { type DocumentData, type Firestore, type Timestamp } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { ClassTrackingDTO, TraceDTO } from '@logina/contracts';
import { AppError, decodeNested, scopedGet } from '@logina/db';
import { relationBucket } from '@logina/domain';
import type { AppDeps, AppEnv } from '../context.js';
import { respond } from '../middleware/respond.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const LETTERS = 'ABCD';

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
const iso = (value: unknown): string => (value as Timestamp).toDate().toISOString();

const emptyCounts = () => ({ full: 0, partial: 0, contradicts: 0, irrelevant: 0 });

async function loadRelease(db: Firestore, lessonId: string, releaseId: string): Promise<DocumentData> {
  return decodeNested((await db.doc(`lessons/${lessonId}/taskReleases/${releaseId}`).get()).data()!);
}

const pairOf = (release: DocumentData, artifact: DocumentData): DocumentData | undefined =>
  (release.teacherContent.pairs as DocumentData[]).find(
    (p) => p.answerOptionId === release.answerIdMap[artifact.answerId] && p.generatedEId === release.evidenceIdMap[artifact.evidenceId],
  );

export function trackingRoutes({ db }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/assignments/:id/tracking', async (c) => {
    const assignmentId = c.req.param('id');
    const { schoolId } = c.var.user;
    const assignment = await scopedGet(db.doc(`assignments/${assignmentId}`), schoolId);
    if (!assignment) throw new AppError('NOT_FOUND', 404, 'Not found.');
    const lessonId = assignment.lessonId as string;
    const releaseIds = assignment.releaseIds as Record<string, string>;
    const releases = Object.fromEntries(await Promise.all(SLOTS.map(async (slot) => [slot, await loadRelease(db, lessonId, releaseIds[slot]!)] as const)));

    const attempts = await db.collection('attempts').where('schoolId', '==', schoolId).where('assignmentId', '==', assignmentId).get();
    const loaded = await Promise.all(
      attempts.docs.map(async (doc) => {
        const tasks = await doc.ref.collection('tasks').get();
        const withDelivery = await Promise.all(
          tasks.docs.map(async (task) => {
            const data = task.data();
            const delivery = data.deliveryId ? (await task.ref.collection('deliveries').doc(data.deliveryId as string).get()).data() : undefined;
            return { slot: task.id, data, delivery };
          }),
        );
        return { id: doc.id, attempt: doc.data(), tasks: withDelivery };
      }),
    );

    const participants = loaded.map(({ id, attempt, tasks }) => {
      const submitted = tasks.filter((t) => t.data.submittedAt);
      const q1 = tasks.find((t) => t.slot === 'Q1')?.data;
      return {
        attemptId: id,
        ...(attempt.participantCode ? { participantCode: attempt.participantCode } : {}),
        isSimulated: attempt.isSimulated === true,
        status: attempt.status,
        submittedCount: attempt.submittedCount,
        keepCount: submitted.filter((t) => t.data.choice === 'KEEP').length,
        reviseCount: submitted.filter((t) => t.data.choice === 'REVISE').length,
        ...(q1?.initialConfidence !== undefined ? { confidenceBefore: q1.initialConfidence } : {}),
        ...(q1?.finalConfidence !== undefined ? { confidenceAfter: q1.finalConfidence } : {}),
      };
    });

    const perTask = SLOTS.map((slot) => {
      const rows = loaded.flatMap((l) => l.tasks.filter((t) => t.slot === slot && t.data.submittedAt));
      const delivered = new Map<string, number>();
      for (const row of rows) {
        const label = row.delivery?.challengeLabel as string;
        delivered.set(label, (delivered.get(label) ?? 0) + 1);
      }
      return {
        slot,
        submitted: rows.length,
        keep: rows.filter((r) => r.data.choice === 'KEEP').length,
        revise: rows.filter((r) => r.data.choice === 'REVISE').length,
        avgConfidenceBefore: average(rows.map((r) => r.data.initialConfidence as number)),
        avgConfidenceAfter: average(rows.map((r) => r.data.finalConfidence as number)),
        deliveredChallenges: [...delivered].map(([label, count]) => ({ label, count })),
      };
    });

    const q1Rows = loaded.flatMap((l) => l.tasks.filter((t) => t.slot === 'Q1' && t.data.submittedAt));
    const before = emptyCounts();
    const after = emptyCounts();
    for (const { data } of q1Rows) {
      before[relationBucket(pairOf(releases.Q1!, data.initialArtifact)?.pairAlignment as string)] += 1;
      after[relationBucket(pairOf(releases.Q1!, data.finalArtifact)?.pairAlignment as string)] += 1;
    }

    return respond(c, ClassTrackingDTO, {
      assignmentId,
      revision: assignment.revision,
      releaseLabels: Object.fromEntries(SLOTS.map((slot) => [slot, releases[slot]!.releaseLabel])),
      counts: { started: participants.length, complete: participants.filter((p) => p.status === 'COMPLETE').length },
      participants,
      perTask,
      q1Relations: { releaseLabel: releases.Q1!.releaseLabel, denominator: q1Rows.length, before, after },
    } as never);
  });

  routes.get('/attempts/:id/trace/:slot', async (c) => {
    const attemptId = c.req.param('id');
    const slot = c.req.param('slot');
    const attempt = await scopedGet(db.doc(`attempts/${attemptId}`), c.var.user.schoolId);
    if (!attempt) throw new AppError('NOT_FOUND', 404, 'Not found.');

    const lessonId = attempt.lessonId as string;
    const release = await loadRelease(db, lessonId, attempt.releaseIds[slot] as string);
    const taskDocs = await db.collection(`attempts/${attemptId}/tasks`).get();
    const task = taskDocs.docs.find((d) => d.id === slot)?.data();
    if (!task?.submittedAt) throw new AppError('NOT_FOUND', 404, 'Not found.');
    const delivery = (await db.doc(`attempts/${attemptId}/tasks/${slot}/deliveries/${task.deliveryId as string}`).get()).data()!;

    const content = release.publicContent as { questionStem: string; answerOptions: DocumentData[]; evidenceOptions: DocumentData[] };
    const lesson = (await db.doc(`lessons/${lessonId}`).get()).data();
    const cardWord = lesson?.contentLocale === 'vi' ? 'Thẻ' : 'Card';

    const option = (artifact: DocumentData) => {
      const a = content.answerOptions.findIndex((x) => x.id === artifact.answerId);
      const e = content.evidenceOptions.findIndex((x) => x.evidenceId === artifact.evidenceId);
      return {
        answer: { letter: LETTERS[a] ?? '', authoringLabel: release.answerIdMap[artifact.answerId] ?? '', text: content.answerOptions[a]?.text ?? '' },
        evidence: { letter: e >= 0 ? `${cardWord} ${LETTERS[e]}` : '', authoringLabel: release.evidenceIdMap[artifact.evidenceId] ?? '', text: content.evidenceOptions[e]?.text ?? '' },
      };
    };
    const before = option(task.initialArtifact as DocumentData);
    const after = option(task.finalArtifact as DocumentData);
    const relation = (artifact: DocumentData) => (pairOf(release, artifact)?.relationLabel as string | undefined) ?? '';
    const candidate = (release.teacherContent.candidates as DocumentData[]).find((x) => x.challengeId === delivery.challengeId);

    return respond(c, TraceDTO, {
      ...(attempt.participantCode ? { participantCode: attempt.participantCode } : {}),
      isSimulated: attempt.isSimulated === true,
      ...(attempt.completedAt ? { completedAt: iso(attempt.completedAt) } : {}),
      releaseLabel: release.releaseLabel,
      slotChips: SLOTS.map((s) => ({ slot: s, choice: taskDocs.docs.find((d) => d.id === s)?.data().choice ?? null })),
      slot,
      questionStem: content.questionStem,
      before: { ...before, confidence: task.initialConfidence, lockedAt: iso(task.lockedAt), relationLabel: relation(task.initialArtifact as DocumentData) },
      challenge: { label: delivery.challengeLabel, message: delivery.renderedMessage, whySelected: candidate?.whenShownForTeacher ?? '', studentChoice: task.choice },
      after: {
        answer: { ...after.answer, changed: (task.changedElements as string[]).includes('answer') },
        evidence: { ...after.evidence, changed: (task.changedElements as string[]).includes('evidence') },
        confidenceBefore: task.initialConfidence,
        confidenceAfter: task.finalConfidence,
        submittedAt: iso(task.submittedAt),
        relationLabel: relation(task.finalArtifact as DocumentData),
      },
    } as never);
  });

  return routes;
}
