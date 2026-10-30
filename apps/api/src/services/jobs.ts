import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { newId } from '@logina/db';
import type { JobDTO } from '@logina/contracts';

/** Step labels are keys; the web app shows them in the user's language (PRD F-I5). */
const STEPS: Record<string, string[]> = {
  PARSE: ['read', 'claims', 'issues', 'questions'],
  GENERATE: ['sufficiency', 'drafts', 'checks'],
  RERUN: ['recheck'],
};

export interface JobDoc {
  id: string;
  schoolId: string;
  lessonId: string;
  type: JobDTO['type'];
  status: JobDTO['status'];
  steps: JobDTO['steps'];
  targetIds: string[];
  question?: JobDTO['question'];
  error?: { code: NonNullable<JobDTO['errorCode']> };
}

export async function createJob(
  db: Firestore,
  job: { schoolId: string; lessonId: string; type: JobDoc['type']; targetIds?: string[] },
): Promise<JobDoc> {
  const doc: JobDoc = {
    id: newId('job'),
    schoolId: job.schoolId,
    lessonId: job.lessonId,
    type: job.type,
    status: 'QUEUED',
    steps: (STEPS[job.type] ?? ['run']).map((label) => ({ label, status: 'PENDING' })),
    targetIds: job.targetIds ?? [],
  };
  await db.doc(`jobs/${doc.id}`).create({ ...doc, attempt: 0, createdAt: FieldValue.serverTimestamp() });
  return doc;
}

export const toJobDTO = (job: JobDoc): JobDTO => ({
  id: job.id,
  type: job.type,
  status: job.status,
  steps: job.steps,
  ...(job.question ? { question: job.question } : {}),
  ...(job.error ? { errorCode: job.error.code } : {}),
});
