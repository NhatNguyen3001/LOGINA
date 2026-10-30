import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { exportRow, pendingRowIds } from '../../apps/worker/src/research/export-row.js';
import { googleSheet } from '../../apps/worker/src/research/sheets.js';

/** Sends every research row that hasn't reached the Sheet yet. Needs GCP_PROJECT_ID and RESEARCH_SHEET_ID. */
const { GCP_PROJECT_ID, RESEARCH_SHEET_ID, FIRESTORE_DATABASE_ID } = process.env;
if (!GCP_PROJECT_ID || !RESEARCH_SHEET_ID) throw new Error('Set GCP_PROJECT_ID and RESEARCH_SHEET_ID.');

const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID }), FIRESTORE_DATABASE_ID || '(default)');
const sheet = googleSheet(RESEARCH_SHEET_ID);
const ids = await pendingRowIds(db);
for (const id of ids) await exportRow(db, sheet, id);
console.log(`Sent ${ids.length} rows.`);
