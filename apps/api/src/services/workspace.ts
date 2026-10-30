import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { copySnapshotIntoWorkspace } from '@logina/db';

const RESUME_AFTER_MS = 30_000;

export interface Workspace {
  schoolId: string;
  teacherUid: string;
  classId: string;
}

export interface WorkspaceOptions {
  snapshotId?: string | undefined;
  skipCopy?: boolean;
  pollMs?: number;
  /** Runs once for a new workspace; throwing refuses it before anything is written. */
  beforeCreate?: () => Promise<void>;
}

export const workspaceId = (uid: string): string => `wks_${uid}`;

const workspaceOf = (uid: string): Workspace => {
  const schoolId = workspaceId(uid);
  return { schoolId, teacherUid: `tch_${uid}`, classId: `${schoolId}_12a3` };
};

async function finishCopy(db: Firestore, { schoolId, teacherUid, classId }: Workspace, opts: WorkspaceOptions): Promise<void> {
  if (opts.snapshotId && !opts.skipCopy) await copySnapshotIntoWorkspace(db, opts.snapshotId, { schoolId, teacherUid, classId });
  await db.doc(`schools/${schoolId}`).update({ readyAt: FieldValue.serverTimestamp() });
}

/** A browser's private workspace, created on its first call. Safe to call from two tabs at once. */
export async function ensureWorkspace(
  db: Firestore,
  uid: string,
  opts: WorkspaceOptions = {},
): Promise<Workspace> {
  const workspace = workspaceOf(uid);
  const { schoolId, teacherUid, classId } = workspace;
  const schoolRef = db.doc(`schools/${schoolId}`);

  const existing = (await schoolRef.get()).data();
  if (existing?.readyAt) return workspace;
  if (!existing) await opts.beforeCreate?.();

  const created = await db.runTransaction(async (tx) => {
    if ((await tx.get(schoolRef)).exists) return false;
    tx.create(schoolRef, {
      name: 'Demo workspace',
      uiLocale: 'en',
      readyAt: null,
      copyStartedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(db.doc(`classes/${classId}`), {
      schoolId,
      name: '12A3',
      teacherIds: [teacherUid],
      studentIds: [],
      studentCount: 0,
    });
    tx.create(db.doc(`users/${teacherUid}`), {
      schoolId,
      role: 'teacher',
      displayName: 'Ms. Lan',
      classIds: [classId],
      isDemo: true,
      uiLocale: 'en',
    });
    return true;
  });
  if (created) {
    await finishCopy(db, workspace, opts);
    return workspace;
  }

  for (;;) {
    const school = (await schoolRef.get()).data();
    if (school?.readyAt) return workspace;
    const startedAt = (school?.copyStartedAt as Timestamp | undefined)?.toDate().getTime() ?? 0;
    if (Date.now() - startedAt > RESUME_AFTER_MS) {
      await schoolRef.update({ copyStartedAt: FieldValue.serverTimestamp() });
      await finishCopy(db, workspace, opts);
      return workspace;
    }
    await new Promise((resolve) => setTimeout(resolve, opts.pollMs ?? 200));
  }
}
