import { FieldValue } from 'firebase-admin/firestore';
import { Hono } from 'hono';
import { JobAnswerReq, JobDTO } from '@logina/contracts';
import { AppError, scopedGet } from '@logina/db';
import type { AppDeps, AppEnv } from '../context.js';
import { withIdempotency } from '../middleware/idempotency.js';
import { respond } from '../middleware/respond.js';
import { toJobDTO, type JobDoc } from '../services/jobs.js';

const TERMINAL = ['DONE', 'FAILED', 'TIMED_OUT'];

export function jobRoutes({ db, enqueue }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  const load = async (schoolId: string, id: string): Promise<JobDoc> => {
    const job = await scopedGet(db.doc(`jobs/${id}`), schoolId);
    if (!job) throw new AppError('NOT_FOUND', 404, 'Not found.');
    return job as unknown as JobDoc;
  };

  routes.get('/:id', async (c) => respond(c, JobDTO, toJobDTO(await load(c.var.user.schoolId, c.req.param('id')))));

  routes.post(
    '/:id/cancel',
    withIdempotency(db, async (c) => {
      const job = await load(c.var.user.schoolId, c.req.param('id') as string);
      if (TERMINAL.includes(job.status)) throw new AppError('JOB_FINISHED', 409, 'This job has already finished.');
      await db.doc(`jobs/${job.id}`).update({ status: 'CANCELLED', finishedAt: FieldValue.serverTimestamp() });
      await db.doc(`lessons/${job.lessonId}`).update({ activeJobId: FieldValue.delete(), stage: 'CREATE' });
      return respond(c, JobDTO, toJobDTO({ ...job, status: 'CANCELLED' }));
    }),
  );

  routes.post(
    '/:id/answer',
    withIdempotency(db, async (c) => {
      const job = await load(c.var.user.schoolId, c.req.param('id') as string);
      const req = JobAnswerReq.safeParse(await c.req.json());
      if (!req.success) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
      if (job.status !== 'NEEDS_INPUT' || !job.question) {
        throw new AppError('JOB_NOT_WAITING', 409, 'This job is not waiting for an answer.');
      }
      if (req.data.choice === 'USE_DETECTED') {
        await db.doc(`lessons/${job.lessonId}`).update({
          contentLocale: job.question.detected,
          version: FieldValue.increment(1),
        });
      }
      await db.doc(`jobs/${job.id}`).update({ status: 'QUEUED', answer: req.data.choice });
      await enqueue({ jobId: job.id, type: job.type, lessonId: job.lessonId, targetIds: job.targetIds });
      return respond(c, JobDTO, toJobDTO({ ...job, status: 'QUEUED' }));
    }),
  );

  return routes;
}
