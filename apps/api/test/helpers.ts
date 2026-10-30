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
  close: () => Promise<void>;
}

export interface Client {
  session: AnonSession;
  workspace: Workspace;
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown, key?: string) => Promise<Response>;
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

  return { live, app, sessions, enqueued, client, close };
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
