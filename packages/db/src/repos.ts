import type { DocumentData, DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/** Tenant check on every load by ID: another school's document reads as missing. */
export async function scopedGet(ref: DocumentReference, schoolId: string): Promise<DocumentData | null> {
  const data = (await ref.get()).data();
  return data && data.schoolId === schoolId ? { id: ref.id, ...data } : null;
}

export const lessonsRepo = {
  get: (db: Firestore, schoolId: string, lessonId: string) => scopedGet(db.doc(`lessons/${lessonId}`), schoolId),

  listForTeacher: async (db: Firestore, schoolId: string, teacherUid: string) => {
    const snapshot = await db
      .collection('lessons')
      .where('schoolId', '==', schoolId)
      .where('editorTeacherIds', 'array-contains', teacherUid)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  setActiveJob: (db: Firestore, tx: Transaction, lessonId: string, jobId: string | null) =>
    tx.update(db.doc(`lessons/${lessonId}`), { activeJobId: jobId ?? FieldValue.delete() }),
};

export const auditRepo = {
  append: (db: Firestore, tx: Transaction, eventId: string, event: DocumentData) =>
    tx.create(db.doc(`auditLog/${eventId}`), { ...event, at: FieldValue.serverTimestamp() }),
};

const previewViewRef = (db: Firestore, uid: string, draftId: string) => db.doc(`previewViews/${uid}_${draftId}`);

export const previewViewsRepo = {
  record: (db: Firestore, schoolId: string, uid: string, draftId: string, previewHash: string) =>
    previewViewRef(db, uid, draftId).set({ schoolId, uid, draftId, previewHash, viewedAt: FieldValue.serverTimestamp() }),

  get: (db: Firestore, schoolId: string, uid: string, draftId: string) =>
    scopedGet(previewViewRef(db, uid, draftId), schoolId),
};
