import { randomUUID } from 'node:crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { anonToken, liveSetup, type AnonSession, type LiveProject } from '@logina/test-utils';
import type { Hono } from 'hono';
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
export async function harness(config: Partial<Config> = {}, deps: Partial<AppDeps> = {}): Promise<Harness> {
  const live = await liveSetup();
  const enqueued: Harness['enqueued'] = [];
  const sessions: Client[] = [];
  const app = createApp({
    db: live.db,
    auth: getAuth(getApps().find((a) => a.name === 'logina-live-tests')!),
    enqueue: async (job) => {
      enqueued.push(job);
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

export const minimalLesson = (classId: string) => ({
  title: 'Test lesson',
  subject: 'Geography',
  topic: 'Labor',
  level: 'basic',
  primaryClassId: classId,
  objective: 'Weigh evidence',
});
