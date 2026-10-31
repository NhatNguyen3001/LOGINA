import type { DocumentData } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { Artifact, AttemptDTO, DraftReq, LockReq, StudentChallengeDTO, StudentFeedbackDTO, StudentTaskDTO, SubmitReq, SubmitResultDTO } from '@logina/contracts';
import { AppError } from '@logina/db';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { answerLabel, artifactSummary, loadAttempt, loadRelease, lockTask, resetAttempt, restartAttempt, startAttempt, submitTask, toChallengeDTO } from '../services/runtime.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const CARD_WORD = { en: 'Card', vi: 'Thẻ' };

export function studentRoutes({ db, enqueue, config }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const body = async <S extends z.ZodType>(raw: unknown, schema: S): Promise<z.infer<S>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
    return parsed.data;
  };

  routes.post(
    '/assignments/:id/attempts',
    withIdempotency(db, async (c) => respond(c, AttemptDTO, await startAttempt(db, c.var.user, c.req.param('id') as string))),
  );

  routes.post(
    '/assignments/:id/attempts/restart',
    withIdempotency(db, async (c) => respond(c, AttemptDTO, await restartAttempt(db, c.var.user, c.req.param('id') as string))),
  );

  routes.post(
    '/attempts/:id/reset',
    withIdempotency(db, async (c) => respond(c, AttemptDTO, await resetAttempt(db, c.var.user, c.req.param('id') as string))),
  );

  routes.get('/attempts/:id/tasks/:slot', async (c) => {
    const slot = c.req.param('slot');
    const attemptId = c.req.param('id');
    const attempt = await loadAttempt(db, c.var.user, attemptId);
    const release = await loadRelease(db, attempt, slot);
    const tasks = await db.collection(`attempts/${attemptId}/tasks`).get();
    const task = tasks.docs.find((doc) => doc.id === slot)!.data();

    if (!task.openedAt) await db.doc(`attempts/${attemptId}/tasks/${slot}`).update({ openedAt: FieldValue.serverTimestamp() });
    const content = release.publicContent as DocumentData;
    const shared = {
      slot,
      phase: task.phase,
      stem: content.questionStem,
      draftArtifact: task.draftArtifact ?? null,
      submittedSlots: tasks.docs.filter((doc) => doc.data().phase === 'SUBMITTED').map((doc) => doc.id),
      ...(task.lockedAt ? { initialArtifact: task.initialArtifact, initialConfidence: task.initialConfidence } : {}),
    };
    return respond(
      c,
      StudentTaskDTO,
      (slot === 'Q1'
        ? { ...shared, answers: content.answerOptions, evidence: content.evidenceOptions.map((e: DocumentData) => ({ id: e.evidenceId, text: e.text })) }
        : { ...shared, taskBody: content.taskBody }) as never,
    );
  });

  routes.put(
    '/attempts/:id/tasks/:slot/draft',
    withIdempotency(db, async (c) => {
      const attemptId = c.req.param('id') as string;
      const slot = c.req.param('slot') as string;
      await loadAttempt(db, c.var.user, attemptId);
      const { draftArtifact } = await body(await c.req.json(), DraftReq);
      const ref = db.doc(`attempts/${attemptId}/tasks/${slot}`);
      if ((await ref.get()).data()?.lockedAt) throw new AppError('ALREADY_LOCKED', 409, 'This answer is locked.');
      await ref.update({ draftArtifact });
      return c.json({ ok: true });
    }),
  );

  routes.post(
    '/attempts/:id/tasks/:slot/lock',
    withIdempotency(db, async (c) => {
      const request = await body(await c.req.json(), LockReq);
      const challenge = await lockTask(db, c.var.user, c.req.param('id') as string, c.req.param('slot') as string, request);
      return respond(c, StudentChallengeDTO, challenge);
    }),
  );

  routes.get('/attempts/:id/tasks/:slot/challenge', async (c) => {
    const attemptId = c.req.param('id');
    const slot = c.req.param('slot');
    const attempt = await loadAttempt(db, c.var.user, attemptId);
    const release = await loadRelease(db, attempt, slot);
    const taskRef = db.doc(`attempts/${attemptId}/tasks/${slot}`);
    const task = (await taskRef.get()).data()!;
    if (!task.deliveryId) throw new AppError('NOT_LOCKED', 409, 'Lock in the answer first.');
    const delivery = (await taskRef.collection('deliveries').doc(task.deliveryId as string).get()).data()!;
    return respond(c, StudentChallengeDTO, toChallengeDTO(task, delivery, task.deliveryId as string, release));
  });

  routes.post(
    '/attempts/:id/tasks/:slot/submit',
    withIdempotency(db, async (c) => {
      const request = await body(await c.req.json(), SubmitReq);
      const research = { enabled: config.researchEnabled, participantType: config.participantType };
      const { researchRowId, ...result } = await submitTask(db, c.var.user, c.req.param('id') as string, c.req.param('slot') as string, request, research);
      if (researchRowId) {
        // The Sheet can wait: a failed enqueue never reaches the student, and research:flush resends the row.
        await enqueue({ jobId: researchRowId, type: 'EXPORT_ROW', targetIds: [researchRowId] }).catch((error: unknown) => console.error(error));
      }
      return respond(c, SubmitResultDTO, result);
    }),
  );

  routes.get('/attempts/:id/feedback', async (c) => {
    const attemptId = c.req.param('id');
    const attempt = await loadAttempt(db, c.var.user, attemptId);
    if (attempt.status !== 'COMPLETE') throw new AppError('ATTEMPT_INCOMPLETE', 409, 'Finish all five tasks first.');
    const lesson = (await db.doc(`lessons/${attempt.lessonId as string}`).get()).data();
    const cardWord = CARD_WORD[(lesson?.contentLocale ?? 'en') as 'en' | 'vi'];

    const rows = await Promise.all(
      SLOTS.map(async (slot) => {
        const release = await loadRelease(db, attempt, slot);
        const taskRef = db.doc(`attempts/${attemptId}/tasks/${slot}`);
        const task = (await taskRef.get()).data()!;
        const delivery = (await taskRef.collection('deliveries').doc(task.deliveryId as string).get()).data()!;
        const initial = Artifact.parse(task.initialArtifact);
        const final = Artifact.parse(task.finalArtifact);
        return {
          slot,
          choice: task.choice,
          initial: { label: answerLabel(initial, release, cardWord), text: artifactSummary(initial, release).answerText },
          challengeMessage: delivery.renderedMessage,
          final: { label: answerLabel(final, release, cardWord), text: artifactSummary(final, release).answerText },
          confidenceBefore: task.initialConfidence,
          confidenceAfter: task.finalConfidence,
          explanations: release.feedbackContent,
        };
      }),
    );
    return respond(c, z.array(StudentFeedbackDTO), rows);
  });

  return routes;
}
