import { randomUUID } from 'node:crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { anonToken, liveSetup, type AnonSession, type LiveProject } from '@logina/test-utils';
import type { Hono } from 'hono';
import { encodeNested, newId } from '@logina/db';
import { loadFixture, type IssuesFixture, type SourceFixture } from '@logina/domain';
import { testWorkerConfig } from '../../worker/src/config.js';
import { createWorker } from '../../worker/src/worker.js';
import { createApp } from '../src/app.js';
import { createJob } from '../src/services/jobs.js';
import { testConfig, type Config } from '../src/config.js';
import type { AppDeps, AppEnv, EnqueueFn } from '../src/context.js';
import { ensureWorkspace, workspaceId, type Workspace } from '../src/services/workspace.js';

export const noFiles: AppDeps['files'] = {
  read: async () => Buffer.alloc(0),
  remove: async () => {},
  signWriteUrl: async () => '',
  signReadUrl: async () => '',
};

export interface Harness {
  live: LiveProject;
  app: Hono<AppEnv>;
  sessions: Client[];
  enqueued: Parameters<EnqueueFn>[0][];
  client: () => Promise<Client>;
  runJob: (jobId: string) => Promise<void>;
  close: () => Promise<void>;
}

export interface Client {
  session: AnonSession;
  workspace: Workspace;
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown, key?: string) => Promise<Response>;
  put: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body?: unknown) => Promise<Response>;
}

/** Files live in the real test bucket; only URL signing is faked, since it needs a service account. */
export async function harness(
  config: Partial<Config> = {},
  deps: Partial<AppDeps> = {},
  options: { runJobs?: boolean | string[] } = {},
): Promise<Harness> {
  const live = await liveSetup();
  const enqueued: Harness['enqueued'] = [];
  const sessions: Client[] = [];
  const worker = createWorker({
    db: live.db,
    bucket: live.bucket,
    genai: { generate: async () => { throw new Error('Tests never call Gemini.'); } },
    config: testWorkerConfig(),
    loadFixture,
  });
  const app = createApp({
    db: live.db,
    auth: getAuth(getApps().find((a) => a.name === 'logina-live-tests')!),
    enqueue: async (job) => {
      enqueued.push(job);
      const run = options.runJobs === true || (Array.isArray(options.runJobs) && options.runJobs.includes(job.type));
      if (run) await worker.runJob(job.jobId);
    },
    config: testConfig(config),
    now: () => new Date(),
    files: {
      read: async (path) => (await live.bucket.file(path).download())[0],
      remove: async (path) => {
        await live.bucket.file(path).delete({ ignoreNotFound: true });
      },
      signWriteUrl: async (path) => `https://signed.test/write/${path}`,
      signReadUrl: async (path) => `https://signed.test/read/${encodeURIComponent(path)}`,
    },
    ...deps,
  });

  const client = async (): Promise<Client> => {
    const session = await anonToken();
    const workspace = await ensureWorkspace(live.db, session.uid);
    const headers = { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json' };
    const made: Client = {
      session,
      workspace,
      get: (path) => Promise.resolve(app.request(`/api/v1${path}`, { headers })),
      patch: (path, body = {}) =>
        Promise.resolve(
          app.request('/api/v1' + path, {
            method: 'PATCH',
            headers: { ...headers, 'Idempotency-Key': randomUUID() },
            body: JSON.stringify(body),
          }),
        ),
      put: (path, body = {}) =>
        Promise.resolve(
          app.request('/api/v1' + path, {
            method: 'PUT',
            headers: { ...headers, 'Idempotency-Key': randomUUID() },
            body: JSON.stringify(body),
          }),
        ),
      post: (path, body = {}, key = randomUUID()) =>
        Promise.resolve(
          app.request(`/api/v1${path}`, {
            method: 'POST',
            headers: { ...headers, 'Idempotency-Key': key },
            body: JSON.stringify(body),
          }),
        ),
    };
    sessions.push(made);
    return made;
  };

  const close = async (): Promise<void> => {
    for (const { session } of sessions) {
      const schoolId = workspaceId(session.uid);
      const lessons = await live.db.collection('lessons').where('schoolId', '==', schoolId).get();
      await Promise.all(lessons.docs.map((doc) => live.db.recursiveDelete(doc.ref)));
      for (const collection of ['jobs', 'assignments', 'attempts', 'previewViews']) {
        const docs = await live.db.collection(collection).where('schoolId', '==', schoolId).get();
        await Promise.all(docs.docs.map((doc) => live.db.recursiveDelete(doc.ref)));
      }
      await live.db.doc(`classes/${schoolId}_12a3`).delete();
      await live.db.doc(`users/tch_${session.uid}`).delete();
      await live.db.doc(`schools/${schoolId}`).delete();
      await session.close();
    }
  };

  return { live, app, sessions, enqueued, client, close, runJob: worker.runJob };
}

/** A lesson at Clarify in one batch write, so a test doesn't pay for the whole job. */
export async function seedClarify(h: Harness, client: Client, locale: 'en' | 'vi' = 'en'): Promise<string> {
  const lessonId = newId('les');
  const { db } = h.live;
  const { schoolId, teacherUid, classId } = client.workspace;
  const source = loadFixture('source', locale) as SourceFixture;
  const issues = loadFixture('issues', locale) as IssuesFixture;
  const lessonRef = db.collection('lessons').doc(lessonId);
  const batch = db.batch();
  batch.set(lessonRef, {
    schoolId, title: 'Seeded', subject: 'Geography', topic: 'Labor', level: 'basic', stage: 'CLARIFY', version: 1,
    contentLocale: locale, primaryClassId: classId, editorTeacherIds: [teacherUid], ownerTeacherId: teacherUid,
    aiMode: 'SEEDED', currentIntentVersionId: 'int_1', currentMaterialVersionId: 'mat_1', currentTaskDraftIds: {},
    updatedAt: new Date(),
  });
  batch.set(lessonRef.collection('materialVersions').doc('mat_1'), {
    title: 'Sample', fileName: 'material.pdf', mimeType: 'application/pdf', unitKind: 'PAGE', storagePath: 'demo/material.en.pdf', pageCount: 2, parseStatus: 'DONE',
  });
  batch.set(lessonRef.collection('teacherIntentVersions').doc('int_1'), { version: 1, ...source.intent });
  for (const unit of source.units) batch.set(lessonRef.collection('sourceUnits').doc(unit.id), encodeNested({ ...unit, materialVersionId: 'mat_1', readBy: 'SEEDED' }));
  for (const { id, ...e } of source.evidence) batch.set(lessonRef.collection('sourceEvidence').doc(id), { ...e, materialVersionId: 'mat_1', verificationStatus: 'VERIFIED' });
  for (const { id, ...claim } of source.claims) batch.set(lessonRef.collection('sourceClaims').doc(id), claim);
  for (const { id, ...relation } of source.relations) batch.set(lessonRef.collection('claimEvidenceRelations').doc(id), relation);
  for (const { id, ...issue } of issues) batch.set(lessonRef.collection('clarificationIssues').doc(id), { ...issue, version: 1 });
  await batch.commit();
  return lessonId;
}

export const minimalLesson = (classId: string) => ({
  title: 'Test lesson',
  subject: 'Geography',
  topic: 'Labor',
  level: 'basic',
  primaryClassId: classId,
  objective: 'Weigh evidence',
});

/** A lesson past Source Approval 1 with its drafts, for suites that share one prepared lesson. */
export async function seedGenerated(h: Harness, client: Client): Promise<string> {
  const lessonId = await seedClarify(h, client);
  await h.live.db.doc(`lessons/${lessonId}`).update({ stage: 'GENERATE_PREVIEW', currentSourceModelVersionId: 'smv_1', approvedSourceVersion: 1 });
  await h.live.db.doc(`lessons/${lessonId}/sourceModelVersions/smv_1`).set({ status: 'APPROVED', version: 1 });
  const job = await createJob(h.live.db, { schoolId: client.workspace.schoolId, lessonId, type: 'GENERATE' });
  await h.runJob(job.id);
  return lessonId;
}

/** Runs the real teacher flow to Assign. Slow, so a suite does it once in `beforeAll`. */
export async function seedAssigned(h: Harness, client: Client): Promise<{ lessonId: string; assignmentId: string }> {
  const lessonId = await seedGenerated(h, client);
  const base = `/lessons/${lessonId}`;
  const lesson = async () => (await h.live.db.doc(`lessons/${lessonId}`).get()).data()!;
  await client.post(`${base}/tasks/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: (await lesson()).version });
  const fix = (loadFixture('scripted-edits', 'en') as { id: string; payload: object }[]).find((e) => e.id === 'q4-tn2-fix')!;
  await client.post(`${base}/edits`, { editScope: 'LOGIC', targetType: 'challenge', targetId: (await lesson()).currentTaskDraftIds.Q4, changedRefs: ['TN2'], baseVersion: 3, payload: fix.payload });

  const tasks = async () => ((await (await client.get(`${base}/approval`)).json()) as { tasks: { slot: string; draftVersion: number; previewHash: string; candidateSetVersion: number }[] }).tasks;
  const q1 = (await tasks()).find((t) => t.slot === 'Q1')!;
  await client.post(`${base}/tasks/Q1/dispositions`, { gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'TEACHER_ACCEPT_WITH_REASON', reason: 'Fits this class', baseVersion: q1.draftVersion });
  for (const task of await tasks()) {
    const { slot, draftVersion, previewHash, candidateSetVersion } = task;
    await client.post(`${base}/tasks/${slot}/approve`, { expectedDraftVersion: draftVersion, previewHash, candidateSetVersion, confirmed: true });
  }
  const response = await client.post(`${base}/assignments`, { classId: client.workspace.classId, baseVersion: (await lesson()).version });
  const { assignmentId } = (await response.json()) as { assignmentId: string };
  return { lessonId, assignmentId };
}
