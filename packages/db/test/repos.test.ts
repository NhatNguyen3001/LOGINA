import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { liveSetup, testSchoolId, type LiveProject } from '@logina/test-utils';
import { AppError, auditRepo, bumpVersion, lessonsRepo, previewViewsRepo, scopedGet, writeOnce } from '../src/index.js';

let live: LiveProject;
const schoolId = testSchoolId();
const otherSchool = testSchoolId();
const path = (name: string) => `${schoolId}_scratch/${name}`;

beforeAll(async () => {
  live = await liveSetup();
});

afterAll(async () => {
  await live.db.recursiveDelete(live.db.collection(`${schoolId}_scratch`));
  await live.db.recursiveDelete(live.db.collection('auditLog').doc(schoolId));
  await live.db.doc(`lessons/${schoolId}_l1`).delete();
  await live.db.doc(`previewViews/${schoolId}_d1`).delete();
});

describe('write helpers', () => {
  it('writeOnce refuses to overwrite an existing release', async () => {
    const ref = live.db.doc(path('release'));
    await live.db.runTransaction(async (tx) => writeOnce(tx, ref, { label: 'r1' }));
    await expect(live.db.runTransaction(async (tx) => writeOnce(tx, ref, { label: 'r2' }))).rejects.toThrow();
    expect((await ref.get()).data()).toEqual({ label: 'r1' });
  });

  it('R06 bumpVersion on stale base throws 409', async () => {
    const ref = live.db.doc(path('versioned'));
    await ref.set({ version: 3 });
    const attempt = live.db.runTransaction(async (tx) => bumpVersion(tx, ref, 2));
    await expect(attempt).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
  });

  it('bumpVersion on the current base increments', async () => {
    const ref = live.db.doc(path('versioned2'));
    await ref.set({ version: 3 });
    await live.db.runTransaction(async (tx) => bumpVersion(tx, ref, 3));
    expect((await ref.get()).data()?.version).toBe(4);
  });
});

describe('repos', () => {
  it('every repo query is scoped by schoolId', async () => {
    const id = `${schoolId}_l1`;
    await live.db.doc(`lessons/${id}`).set({ schoolId, title: 'x' });
    expect(await lessonsRepo.get(live.db, schoolId, id)).toMatchObject({ title: 'x' });
    expect(await lessonsRepo.get(live.db, otherSchool, id)).toBeNull();
    expect(await scopedGet(live.db.doc(`lessons/${id}`), otherSchool)).toBeNull();
  });

  it('audit append happens in the same transaction', async () => {
    const eventId = `${schoolId}_aborted`;
    await expect(
      live.db.runTransaction(async (tx) => {
        auditRepo.append(live.db, tx, eventId, { schoolId, actor: 'a', action: 'x', targetType: 't', targetId: 'i' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await live.db.doc(`auditLog/${eventId}`).get()).exists).toBe(false);
  });

  it('previewViews record overwrites the last view per user and draft', async () => {
    await previewViewsRepo.record(live.db, schoolId, schoolId, 'd1', 'h1');
    await previewViewsRepo.record(live.db, schoolId, schoolId, 'd1', 'h2');
    expect(await previewViewsRepo.get(live.db, schoolId, schoolId, 'd1')).toMatchObject({ previewHash: 'h2' });
  });
});
