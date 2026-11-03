import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { FileStore } from '../context.js';

const LESSON_COLLECTIONS = ['assignments', 'attempts', 'jobs'];

/** Removes a lesson document, everything under it, and the files a teacher uploaded for it. */
export async function removeLessonTree(db: Firestore, files: FileStore, lesson: DocumentReference): Promise<void> {
  const materials = await lesson.collection('materialVersions').get();
  await Promise.all(
    materials.docs
      .map((doc) => doc.data().storagePath as string | undefined)
      .filter((path): path is string => Boolean(path?.startsWith('uploads/')))
      .map((path) => files.remove(path)),
  );
  await db.recursiveDelete(lesson);
}

/** One lesson and its assignments, attempts and jobs, in this workspace only. Research rows stay, as on Reset demo. */
export async function deleteLesson(db: Firestore, files: FileStore, schoolId: string, lessonId: string): Promise<void> {
  for (const name of LESSON_COLLECTIONS) {
    const docs = await db.collection(name).where('schoolId', '==', schoolId).where('lessonId', '==', lessonId).get();
    await Promise.all(docs.docs.map((doc) => db.recursiveDelete(doc.ref)));
  }
  await removeLessonTree(db, files, db.doc(`lessons/${lessonId}`));
}
