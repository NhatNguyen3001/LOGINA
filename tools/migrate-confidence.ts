/**
 * One-off: confidence was saved out of 100 until the 0 to 10 API went live (api-00019, 2026-11-04T11:48:38Z).
 * Converts every answer locked or submitted before then, in attempts and in the demo snapshots, so the stored
 * value is out of 10 whatever it was (including old answers of 10 or below, which the API cannot tell apart).
 * Converted tasks get confidenceScale: 10, so a second run changes nothing. Research rows are left as recorded.
 * Usage: tsx tools/migrate-confidence.ts            (dry run: counts only)
 *        tsx tools/migrate-confidence.ts --apply    (writes)
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { pathToFileURL } from 'node:url';

export const CUTOVER = Date.parse('2026-11-04T11:48:38Z');
const TASK_PATH = /^attempts\/[^/]+\/tasks\/[^/]+$/;
const BATCH_SIZE = 400;

type Stamp = { toMillis: () => number } | undefined;
type TaskData = Record<string, unknown> & { lockedAt?: Stamp; submittedAt?: Stamp; initialConfidence?: unknown; finalConfidence?: unknown; confidenceScale?: unknown };
export type TaskPatch = { initialConfidence?: number; finalConfidence?: number; confidenceDelta?: number; confidenceScale: 10 };

const tenth = (value: number) => Math.round(value / 10);
const beforeCutover = (stamp: Stamp, cutover: number) => typeof stamp?.toMillis === 'function' && stamp.toMillis() < cutover;

/** The fields to change on one task, or null when it is already out of 10. */
export function convertTask(data: TaskData, cutover = CUTOVER): TaskPatch | null {
  if (data.confidenceScale === 10) return null;
  const patch: TaskPatch = { confidenceScale: 10 };
  let changed = false;
  if (typeof data.initialConfidence === 'number' && beforeCutover(data.lockedAt, cutover)) {
    patch.initialConfidence = tenth(data.initialConfidence);
    changed = true;
  }
  if (typeof data.finalConfidence === 'number' && beforeCutover(data.submittedAt, cutover)) {
    patch.finalConfidence = tenth(data.finalConfidence);
    changed = true;
  }
  if (!changed) return null;
  const initial = patch.initialConfidence ?? data.initialConfidence;
  const final = patch.finalConfidence ?? data.finalConfidence;
  if (typeof initial === 'number' && typeof final === 'number') patch.confidenceDelta = final - initial;
  return patch;
}

async function main(apply: boolean) {
  const app = initializeApp({ credential: applicationDefault(), projectId: process.env.GCP_PROJECT_ID ?? 'logina-dev' });
  const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || '(default)');
  const writes: { ref: DocumentReference; patch: Record<string, unknown> }[] = [];
  let small = 0;
  const countSmall = (data: TaskData, patch: TaskPatch) => {
    if ((patch.initialConfidence !== undefined && (data.initialConfidence as number) <= 10) || (patch.finalConfidence !== undefined && (data.finalConfidence as number) <= 10)) small += 1;
  };

  const tasks = (await db.collectionGroup('tasks').get()).docs.filter((doc) => TASK_PATH.test(doc.ref.path));
  for (const doc of tasks) {
    const patch = convertTask(doc.data() as TaskData);
    if (!patch) continue;
    countSmall(doc.data() as TaskData, patch);
    writes.push({ ref: doc.ref, patch });
  }
  const liveCount = writes.length;

  /** Snapshot copies keep each document as { path, data }; new workspaces copy them, so they change too. */
  const stored = (await db.collectionGroup('docs').get()).docs.filter((doc) => doc.ref.parent.parent?.parent.id === 'demoSnapshots' && TASK_PATH.test(String(doc.data().path ?? '')));
  for (const doc of stored) {
    const data = doc.data().data as TaskData;
    const patch = convertTask(data);
    if (!patch) continue;
    countSmall(data, patch);
    writes.push({ ref: doc.ref, patch: Object.fromEntries(Object.entries(patch).map(([key, value]) => [`data.${key}`, value])) });
  }

  console.log(`Answer tasks scanned: ${tasks.length}. To convert: ${liveCount}.`);
  console.log(`Snapshot tasks scanned: ${stored.length}. To convert: ${writes.length - liveCount}.`);
  console.log(`Of these, ${small} had an old value of 10 or below (read wrongly until now).`);
  if (!apply) {
    console.log('Dry run: nothing written. Run again with --apply to convert.');
    return;
  }
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { ref, patch } of writes.slice(i, i + BATCH_SIZE)) batch.update(ref, patch);
    await batch.commit();
  }
  console.log(`Converted ${writes.length} tasks.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.includes('--apply')).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
