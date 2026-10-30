import { serve } from '@hono/node-server';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { Hono } from 'hono';
import { loadFixture } from '@logina/domain';
import { vertexGenai } from './ai/gemini.js';
import { loadWorkerConfig } from './config.js';
import { exportRow } from './research/export-row.js';
import { googleSheet } from './research/sheets.js';
import { createWorker } from './worker.js';

const config = loadWorkerConfig();
const project = process.env.GCP_PROJECT_ID ?? 'logina-dev';
const firebase = initializeApp({ credential: applicationDefault(), projectId: project });

const db = getFirestore(firebase, process.env.FIRESTORE_DATABASE_ID || '(default)');
const sheet = process.env.RESEARCH_SHEET_ID ? googleSheet(process.env.RESEARCH_SHEET_ID) : null;

const worker = createWorker({
  db,
  bucket: getStorage(firebase).bucket(config.materialsBucket),
  genai: vertexGenai(project, process.env.VERTEX_LOCATION ?? 'global'),
  config,
  loadFixture,
});

const app = new Hono();
app.post('/jobs/run', async (c) => {
  const { jobId, type } = (await c.req.json()) as { jobId: string; type?: string };
  if (type === 'EXPORT_ROW') await exportRow(db, sheet, jobId);
  else await worker.runJob(jobId);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8081) });
