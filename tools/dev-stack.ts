import { serve } from '@hono/node-server';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { loadFixture } from '@logina/domain';
import { createApp } from '../apps/api/src/app.js';
import { loadConfig } from '../apps/api/src/config.js';
import { loadWorkerConfig } from '../apps/worker/src/config.js';
import { createWorker } from '../apps/worker/src/worker.js';

/** The API and worker in one process, for local browser runs. Gemini is never called: seeded lessons only. */
const env = {
  ...process.env,
  NO_SIGN_IN: 'true',
  DEMO_MODE: 'true',
  SEEDED_AI: 'true',
  SEEDED_STEP_DELAY_MS: '0',
  RESEARCH_ENABLED: process.env.RESEARCH_ENABLED ?? 'false',
  FIRESTORE_DATABASE_ID: process.env.FIRESTORE_DATABASE_ID ?? 'logina-test',
  MATERIALS_BUCKET: process.env.MATERIALS_BUCKET ?? 'logina-dev-test',
};

const config = loadConfig(env);
const firebase = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const db = getFirestore(firebase, config.databaseId);
const bucket = getStorage(firebase).bucket(config.materialsBucket);

const worker = createWorker({
  db,
  bucket,
  genai: { generate: async () => { throw new Error('The dev stack never calls Gemini.'); } },
  config: loadWorkerConfig(env),
  loadFixture,
});

const app = createApp({
  db,
  auth: getAuth(firebase),
  enqueue: async ({ jobId, type }) => {
    if (type === 'EXPORT_ROW') return;
    void worker.runJob(jobId).catch((error: unknown) => console.error(error));
  },
  config,
  now: () => new Date(),
  files: {
    read: async (path) => (await bucket.file(path).download())[0],
    size: async (path) => Number((await bucket.file(path).getMetadata())[0].size),
    remove: async (path) => {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
    signWriteUrl: async () => {
      throw new Error('Uploads need a service account, so they work only when deployed.');
    },
    signReadUrl: async () => 'about:blank',
  },
});

const PORT = Number(process.env.PORT ?? 8090);
serve({ fetch: app.fetch, port: PORT }, () => console.log(`API on http://localhost:${PORT}`));
