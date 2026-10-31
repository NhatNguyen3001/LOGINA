import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { FixtureName } from '@logina/domain';
import { resolveAiMode, type AiPath } from './ai/mode.js';
import type { GenaiClient } from './ai/model.js';
import type { WorkerConfig } from './config.js';
import { JobCancelled, JobFailure, JobPaused } from './errors.js';
import { runGenerate } from './jobs/generate.js';
import { runParse } from './jobs/parse.js';
import { runRerun } from './jobs/rerun.js';

export interface WorkerDeps {
  db: Firestore;
  bucket: { file: (path: string) => { download: () => Promise<[Buffer]> } };
  genai: GenaiClient;
  config: WorkerConfig;
  loadFixture: (name: FixtureName, locale: 'en' | 'vi') => unknown;
  /** Test seam: runs before each step. */
  beforeStep?: () => Promise<unknown>;
}

export interface JobContext {
  deps: WorkerDeps;
  jobId: string;
  job: DocumentData;
  lesson: DocumentData;
  mode: AiPath;
  step: <T>(label: string, work: () => Promise<T>) => Promise<T>;
}

const RUNNABLE = ['QUEUED', 'RUNNING'];
const LIVE_REFUSABLE = ['PARSE', 'ANALYZE'];

export function createWorker(deps: WorkerDeps) {
  const { db, config } = deps;

  const runJob = async (jobId: string): Promise<void> => {
    const jobRef = db.doc(`jobs/${jobId}`);
    const job = (await jobRef.get()).data();
    if (!job || !RUNNABLE.includes(job.status as string)) return;

    const lessonRef = db.doc(`lessons/${job.lessonId as string}`);
    const lesson = (await lessonRef.get()).data();
    if (!lesson) throw new Error(`Job ${jobId} has no lesson`);

    const startedAt = Date.now();
    await jobRef.update({ status: 'RUNNING', startedAt: FieldValue.serverTimestamp() });

    const finish = async (update: DocumentData): Promise<void> => {
      await jobRef.update({ ...update, finishedAt: FieldValue.serverTimestamp() });
      const current = (await lessonRef.get()).data();
      if (current?.activeJobId === jobId) await lessonRef.update({ activeJobId: FieldValue.delete() });
    };

    const step: JobContext['step'] = async (label, work) => {
      await deps.beforeStep?.();
      if ((await jobRef.get()).data()?.status === 'CANCELLED') throw new JobCancelled();
      if (Date.now() - startedAt > config.deadlineMs) throw new JobFailure('TIMED_OUT');
      const result = await work();
      await jobRef.update({ stepsDone: FieldValue.arrayUnion(label) });
      return result;
    };

    try {
      const mode = resolveAiMode({ aiMode: lesson.aiMode as string }, config);
      if (mode === 'LIVE_DISABLED' && LIVE_REFUSABLE.includes(job.type as string)) throw new JobFailure('LIVE_DISABLED');
      const context: JobContext = { deps, jobId, job, lesson: { id: lessonRef.id, ...lesson }, mode, step };

      if (job.type === 'PARSE') await runParse(context);
      else if (job.type === 'GENERATE') await runGenerate(context);
      else if (job.type === 'RERUN') await runRerun(context);
      else throw new Error(`Unknown job type ${job.type as string}`);

      await finish({ status: 'DONE' });
    } catch (error) {
      if (error instanceof JobPaused) return;
      if (error instanceof JobCancelled) {
        await finish({});
      } else if (error instanceof JobFailure) {
        const status = error.code === 'TIMED_OUT' ? 'TIMED_OUT' : 'FAILED';
        await finish({ status, error: { code: error.code, ...(error.detail ? { detail: error.detail } : {}) } });
      } else {
        console.error(error);
        await finish({ status: 'FAILED', error: { code: 'INTERNAL' } });
      }
    }
  };

  return { runJob };
}
