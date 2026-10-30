import type { Firestore } from 'firebase-admin/firestore';

/** Copies a demo snapshot into a workspace. Does nothing until the snapshot exists; B24 fills in the copy. */
export async function copySnapshotIntoWorkspace(db: Firestore, snapshotId: string, schoolId: string): Promise<void> {
  const snapshot = await db.doc(`demoSnapshots/${snapshotId}`).get();
  if (!snapshot.exists) return;
  throw new Error(`Copying snapshot ${snapshotId} into ${schoolId} is not built yet.`);
}
