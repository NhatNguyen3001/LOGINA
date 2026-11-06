import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { parseThought, type FixtureName } from '@logina/domain';
import { resolveAiMode, type AiPath } from './ai/mode.js';
import type { AiWait, GenaiClient } from './ai/model.js';
import type { WorkerConfig } from './config.js';
import { JobCancelled, JobFailure, JobPaused } from './errors.js';
import { runGenerate } from './jobs/generate.js';
import { runParse } from './jobs/parse.js';
import { runRerun, translateJob } from './jobs/rerun.js';

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
  /** Tasks run at the same time, so a long step checks again between its AI calls. */
  checkpoint: () => Promise<void>;
  /** Saves what the model is thinking for the teacher's wait screen. A failed save never stops the job. */
  thought: (step: string, text: string) => Promise<void>;
  /** Shows a busy AI's next try under a step, and clears it on null. A failed save never stops the job. */
  wait: (step: string) => (wait: AiWait | null) => Promise<void>;
}

/** gRPC NOT_FOUND: a reset or delete removed the document while the job ran. */
const isGone = (error: unknown): boolean => (error as { code?: unknown })?.code === 5;

const RUNNABLE = ['QUEUED', 'RUNNING'];
const LIVE_REFUSABLE = ['PARSE', 'ANALYZE'];
const MAX_THOUGHTS = 100;

export function createWorker(deps: WorkerDeps) {
  const { db, config } = deps;

  const runJob = async (jobId: string): Promise<void> => {
    const jobRef = db.doc(`jobs/${jobId}`);
    const job = (await jobRef.get()).data();
    if (!job || !RUNNABLE.includes(job.status as string)) return;

    const lessonRef = db.doc(`lessons/${job.lessonId as string}`);
    const lesson = (await lessonRef.get()).data();
    /** A reset or delete can remove the lesson before its job runs; there is nothing left to do. */
    if (!lesson) {
      console.warn(JSON.stringify({ event: 'JOB_LESSON_GONE', jobId }));
      return;
    }

    const startedAt = Date.now();
    await jobRef.update({ status: 'RUNNING', startedAt: FieldValue.serverTimestamp() });

    const finish = async (update: DocumentData): Promise<void> => {
      try {
        const cancelled = (await jobRef.get()).data()?.status === 'CANCELLED';
        await jobRef.update({ ...(cancelled ? {} : update), finishedAt: FieldValue.serverTimestamp() });
        const current = (await lessonRef.get()).data();
        if (current?.activeJobId === jobId) await lessonRef.update({ activeJobId: FieldValue.delete() });
      } catch (error) {
        if (!isGone(error)) throw error;
      }
    };

    const checkpoint = async (): Promise<void> => {
      const current = await jobRef.get();
      if (!current.exists || current.data()?.status === 'CANCELLED') throw new JobCancelled();
      if (Date.now() - startedAt > config.deadlineMs) throw new JobFailure('TIMED_OUT');
    };

    const step: JobContext['step'] = async (label, work) => {
      await deps.beforeStep?.();
      await checkpoint();
      const result = await work();
      await jobRef.update({ stepsDone: FieldValue.arrayUnion(label) });
      return result;
    };

    let thoughts = 0;
    const thought: JobContext['thought'] = async (stepLabel, text) => {
      if (thoughts >= MAX_THOUGHTS) return;
      thoughts += 1;
      const entry = { step: stepLabel, at: Math.round((Date.now() - startedAt) / 1000), ...parseThought(text) };
      await jobRef.update({ trace: FieldValue.arrayUnion(entry) }).catch((error: unknown) => console.warn(error));
    };

    const wait: JobContext['wait'] = (stepLabel) => async (next) => {
      const field = new FieldPath('waits', stepLabel);
      const value = next ? { step: stepLabel, attempt: next.attempt, of: next.of, retryAt: Timestamp.fromDate(next.retryAt) } : FieldValue.delete();
      await jobRef.update(field, value).catch((error: unknown) => console.warn(error));
    };

    try {
      const mode = resolveAiMode({ aiMode: lesson.aiMode as string }, config);
      if (mode === 'LIVE_DISABLED' && LIVE_REFUSABLE.includes(job.type as string)) throw new JobFailure('LIVE_DISABLED');
      const context: JobContext = { deps, jobId, job, lesson: { id: lessonRef.id, ...lesson }, mode, step, checkpoint, thought, wait };

      if (job.type === 'PARSE') await runParse(context);
      else if (job.type === 'GENERATE') await runGenerate(context);
      else if (job.type === 'RERUN') await runRerun(context);
      else if (job.type === 'TRANSLATE') await translateJob(context);
      else throw new Error(`Unknown job type ${job.type as string}`);

      await finish({ status: 'DONE' });
    } catch (error) {
      if (error instanceof JobPaused) return;
      if (error instanceof JobCancelled) {
        await finish({});
      } else if (error instanceof JobFailure) {
        const status = error.code === 'TIMED_OUT' ? 'TIMED_OUT' : 'FAILED';
        await finish({ status, error: { code: error.code, ...(error.detail ? { detail: error.detail } : {}) } });
      } else if (isGone(error) || !(await jobRef.get()).exists) {
        /** A reset removed the job or its lesson mid-run: stop without an error. */
        console.warn(JSON.stringify({ event: 'JOB_GONE', jobId }));
      } else {
        console.error(error);
        await finish({ status: 'FAILED', error: { code: 'INTERNAL' } });
      }
    }
  };

  return { runJob };
}
