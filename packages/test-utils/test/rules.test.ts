import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadString, type StorageError } from 'firebase/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, liveSetup, testSchoolId, type AnonClient, type LiveProject } from '../src/live.js';

const repoFile = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

describe('deny-all rules in the repo', () => {
  it.each(['firestore.rules', 'storage.rules'])('%s has one allow statement and it denies', (file) => {
    const allows = repoFile(file).match(/\ballow\b[^;]*;/g);
    expect(allows).toEqual(['allow read, write: if false;']);
  });
});

describe('client access to the live project', () => {
  let live: LiveProject | undefined;
  let client: AnonClient | undefined;
  const schoolId = testSchoolId();
  const docPath = `schools/${schoolId}`;
  const objectPath = `${schoolId}/material.pdf`;

  beforeAll(async () => {
    live = await liveSetup();
    client = await anonClient(live.config);
    await live.db.doc(docPath).set({ purpose: 'rules test' });
    await live.bucket.file(objectPath).save('x');
  });

  afterAll(async () => {
    await client?.close();
    await live?.db.doc(docPath).delete();
    await live?.db.doc(`attempts/${schoolId}`).delete();
    await live?.bucket.file(objectPath).delete({ ignoreNotFound: true });
    await live?.bucket.file(`${schoolId}/y.pdf`).delete({ ignoreNotFound: true });
  });

  it('client cannot read or write any path', async () => {
    const { db, uid } = client!;
    expect(uid).toBeTruthy();

    await expect(getDoc(doc(db, docPath))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDoc(doc(db, 'lessons/x'))).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(setDoc(doc(db, `attempts/${schoolId}`), {})).rejects.toMatchObject({ code: 'permission-denied' });

    const written = await live!.db.doc(`attempts/${schoolId}`).get();
    expect(written.exists).toBe(false);
  });

  it('client cannot read or write any Storage path', async () => {
    const { storage } = client!;
    const refused = (error: StorageError) => error.status === 403;

    await expect(getBytes(ref(storage, objectPath))).rejects.toSatisfy(refused);
    await expect(uploadString(ref(storage, `${schoolId}/y.pdf`), 'x')).rejects.toSatisfy(refused);

    const [written] = await live!.bucket.file(`${schoolId}/y.pdf`).exists();
    expect(written).toBe(false);
  });
});
