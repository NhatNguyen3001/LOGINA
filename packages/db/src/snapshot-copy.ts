import { createHash } from 'node:crypto';
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 400;
const SNAPSHOT_COLLECTIONS = ['assignments', 'jobs', 'attempts', 'previewViews'];

export interface SnapshotDoc {
  path: string;
  data: DocumentData;
}

export interface WorkspaceIds {
  schoolId: string;
  teacherUid: string;
  classId: string;
}

export const snapshotId = (locale: string, stepId: string): string => `${locale}_${stepId}`;

function replaceIds(text: string, entries: [string, string][]): string {
  return entries.reduce((result, [from, to]) => result.replaceAll(from, to), text);
}

function remapValue(value: unknown, entries: [string, string][]): unknown {
  if (typeof value === 'string') return replaceIds(value, entries);
  if (Array.isArray(value)) return value.map((item) => remapValue(item, entries));
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [replaceIds(k, entries), remapValue(v, entries)]));
  }
  return value;
}

/** Rewrites IDs and every reference to them, longest first. Hashes contain no IDs, so they stay valid. */
export function remapIds(docs: SnapshotDoc[], idMap: Map<string, string>): SnapshotDoc[] {
  const entries = [...idMap].sort(([a], [b]) => b.length - a.length);
  return docs.map(({ path, data }) => ({ path: replaceIds(path, entries), data: remapValue(data, entries) as DocumentData }));
}

async function collectTree(ref: DocumentReference): Promise<SnapshotDoc[]> {
  const data = (await ref.get()).data();
  const own = data ? [{ path: ref.path, data }] : [];
  const children = await ref.listCollections();
  const nested = await Promise.all(
    children.map(async (collection) => {
      const docs = await collection.listDocuments();
      return (await Promise.all(docs.map(collectTree))).flat();
    }),
  );
  return [...own, ...nested.flat()];
}

export async function captureSnapshot(db: Firestore, id: string, source: { schoolId: string; label: string }): Promise<void> {
  const { schoolId, label } = source;
  const lessons = await db.collection('lessons').where('schoolId', '==', schoolId).get();
  const others = await Promise.all(SNAPSHOT_COLLECTIONS.map((name) => db.collection(name).where('schoolId', '==', schoolId).get()));
  const roots = [...lessons.docs, ...others.flatMap((snapshot) => snapshot.docs)].map((doc) => doc.ref);
  const docs = (await Promise.all(roots.map(collectTree))).flat();

  const ref = db.doc(`demoSnapshots/${id}`);
  await db.recursiveDelete(ref);
  await ref.set({
    label,
    schoolId,
    teacherUid: schoolId.replace(/^wks_/, 'tch_'),
    classId: `${schoolId}_12a3`,
    ids: [...lessons.docs, ...others[0]!.docs, ...others[1]!.docs].map((doc) => doc.id),
    docCount: docs.length,
  });
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((doc, offset) => batch.set(ref.collection('docs').doc(String(i + offset)), doc));
    await batch.commit();
  }
}

export const deleteSnapshot = (db: Firestore, id: string): Promise<void> => db.recursiveDelete(db.doc(`demoSnapshots/${id}`));

/** Copies a demo snapshot into a workspace. The IDs depend only on the workspace, so a rerun overwrites. */
export async function copySnapshotIntoWorkspace(db: Firestore, id: string, target: WorkspaceIds): Promise<void> {
  const meta = (await db.doc(`demoSnapshots/${id}`).get()).data();
  if (!meta) return;

  const suffix = createHash('sha256').update(target.schoolId).digest('hex').slice(0, 10);
  const idMap = new Map<string, string>([
    [meta.schoolId as string, target.schoolId],
    [meta.teacherUid as string, target.teacherUid],
    [meta.classId as string, target.classId],
    ...(meta.ids as string[]).map((old): [string, string] => [old, `${old}_${suffix}`]),
  ]);

  const stored = await db.collection(`demoSnapshots/${id}/docs`).get();
  const docs = remapIds(stored.docs.map((doc) => doc.data() as SnapshotDoc), idMap);
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { path, data } of docs.slice(i, i + BATCH_SIZE)) batch.set(db.doc(path), data);
    await batch.commit();
  }
}
