import { serve } from '@hono/node-server';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { cloudTasksEnqueue } from './jobs/enqueue.js';

const config = loadConfig();
const firebase = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const bucket = getStorage(firebase).bucket(config.materialsBucket);

const app = createApp({
  db: getFirestore(firebase, config.databaseId),
  auth: getAuth(firebase),
  enqueue: cloudTasksEnqueue(process.env),
  config,
  now: () => new Date(),
  files: {
    read: async (path) => (await bucket.file(path).download())[0],
    remove: async (path) => {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
    signWriteUrl: async (path, contentType, expires) =>
      (await bucket.file(path).getSignedUrl({ version: 'v4', action: 'write', contentType, expires }))[0],
    signReadUrl: async (path, expires) =>
      (await bucket.file(path).getSignedUrl({ version: 'v4', action: 'read', expires }))[0],
  },
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
