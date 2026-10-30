import { applicationDefault, initializeApp } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { captureSnapshot, snapshotId } from '@logina/db';
import { loadFixture } from '@logina/domain';
import { createApp } from '../../apps/api/src/app.js';
import { loadConfig } from '../../apps/api/src/config.js';
import { clearWorkspace } from '../../apps/api/src/services/demo.js';
import { ensureWorkspace } from '../../apps/api/src/services/workspace.js';
import { loadWorkerConfig } from '../../apps/worker/src/config.js';
import { createWorker } from '../../apps/worker/src/worker.js';
import { runDemoPath, STEP_LABELS, type Locale } from './demo-path.js';

/** Runs the demo path in process and stores each step. The generator's workspace never holds an older s01. */
const GENERATOR_UID = 'demo_generator';
const TOKEN = 'generator';

const env = { ...process.env, NO_SIGN_IN: 'true', DEMO_MODE: 'true', RESEARCH_ENABLED: 'false', SEEDED_AI: 'true', SEEDED_STEP_DELAY_MS: '0' };
const locale: Locale = env.DEMO_LOCALE === 'vi' ? 'vi' : 'en';
const config = loadConfig(env);
const workerConfig = loadWorkerConfig(env);

const firebase = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const db = getFirestore(firebase, config.databaseId);
const bucket = getStorage(firebase).bucket(config.materialsBucket);

const files = {
  read: async (path: string) => (await bucket.file(path).download())[0],
  size: async (path: string) => Number((await bucket.file(path).getMetadata())[0].size),
  remove: async (path: string) => {
    await bucket.file(path).delete({ ignoreNotFound: true });
  },
  signWriteUrl: async () => '',
  signReadUrl: async () => '',
};

const worker = createWorker({
  db,
  bucket,
  genai: { generate: async () => { throw new Error('Snapshots never call Gemini.'); } },
  config: workerConfig,
  loadFixture,
});

const app = createApp({
  db,
  auth: { verifyIdToken: async () => ({ uid: GENERATOR_UID, firebase: { sign_in_provider: 'anonymous' } }) } as unknown as Auth,
  enqueue: (job) => worker.runJob(job.jobId),
  config,
  now: () => new Date(),
  files,
});

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const workspace = await ensureWorkspace(db, GENERATOR_UID, { skipCopy: true });
await clearWorkspace(db, files, workspace.schoolId);
await db.doc(`schools/${workspace.schoolId}`).update({ readyAt: new Date() });

await runDemoPath(
  {
    workspace,
    get: async (path) => app.request(`/api/v1${path}`, { headers }),
    post: async (path, body = {}) =>
      app.request(`/api/v1${path}`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) }),
  },
  locale,
  async (step) => {
    await captureSnapshot(db, snapshotId(locale, step), { schoolId: workspace.schoolId, label: STEP_LABELS[step][locale] });
    console.log(`Captured ${snapshotId(locale, step)}.`);
  },
);

await clearWorkspace(db, files, workspace.schoolId);
