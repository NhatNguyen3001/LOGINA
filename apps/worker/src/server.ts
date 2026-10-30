import { serve } from '@hono/node-server';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Hono } from 'hono';
import { loadFixture } from '@logina/domain';
import { vertexGenai } from './ai/gemini.js';
import { loadWorkerConfig } from './config.js';
import { createWorker } from './worker.js';

const config = loadWorkerConfig();
const project = process.env.GCP_PROJECT_ID ?? 'logina-dev';
const firebase = initializeApp({ credential: applicationDefault(), projectId: project });

const worker = createWorker({
  db: getFirestore(firebase, process.env.FIRESTORE_DATABASE_ID || '(default)'),
  bucket: getStorage(firebase).bucket(config.materialsBucket),
  genai: vertexGenai(project, process.env.VERTEX_LOCATION ?? 'global'),
  config,
  loadFixture,
});

const app = new Hono();
app.post('/jobs/run', async (c) => {
  const { jobId } = (await c.req.json()) as { jobId: string };
  await worker.runJob(jobId);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8081) });
