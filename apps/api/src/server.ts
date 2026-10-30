import { serve } from '@hono/node-server';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const firebase = initializeApp({ credential: applicationDefault(), projectId: config.projectId });

const app = createApp({
  db: getFirestore(firebase, config.databaseId),
  auth: getAuth(firebase),
  enqueue: async () => {
    throw new Error('Job queue is not configured.');
  },
  config,
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
