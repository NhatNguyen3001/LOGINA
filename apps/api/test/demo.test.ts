import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssignmentListDTO, ClassTrackingDTO, LessonListDTO } from '@logina/contracts';
import { remapIds, snapshotId, captureSnapshot, deleteSnapshot } from '@logina/db';
import { harness, seedAssigned, type Client, type Harness } from './helpers.js';

const STEP = `s01test${Date.now()}`;
const SNAPSHOT = snapshotId('en', STEP);

let h: Harness;
let seed: Client;
let a: Client;
let b: Client;
let assignmentId: string;

const lessonsOf = async (client: Client) => LessonListDTO.parse(await (await client.get('/lessons')).json()).lessons;
const assignmentsOf = async (client: Client) => AssignmentListDTO.parse(await (await client.get('/me/assignments')).json()).assignments;

beforeAll(async () => {
  h = await harness({ readySnapshot: SNAPSHOT, snapshotLocale: 'en' }, {}, { runJobs: ['GENERATE', 'RERUN'] });
  seed = await h.client({ skipCopy: true });
  ({ assignmentId } = await seedAssigned(h, seed));
  await captureSnapshot(h.live.db, SNAPSHOT, { schoolId: seed.workspace.schoolId, label: 'S1' });
  [a, b] = await Promise.all([h.client(), h.client()]);
}, 300_000);

afterAll(async () => {
  await deleteSnapshot(h.live.db, SNAPSHOT);
  await h.close();
});

describe('remapIds', () => {
  it('rewrites every reference and leaves hashes unchanged', () => {
    const docs = [{ path: 'lessons/les_a/taskDrafts/tdr_les_a_Q1_v3', data: { schoolId: 'wks_a', lessonId: 'les_a', contentHash: 'abc', nested: { ids: ['les_a'] } } }];
    expect(remapIds(docs, new Map([['les_a', 'les_b'], ['wks_a', 'wks_b']]))).toEqual([
      { path: 'lessons/les_b/taskDrafts/tdr_les_b_Q1_v3', data: { schoolId: 'wks_b', lessonId: 'les_b', contentHash: 'abc', nested: { ids: ['les_b'] } } },
    ]);
  });
});

describe('ready assignment', () => {
  it('a new workspace starts with the ready Bài 8 set and no attempts', async () => {
    const assignments = await assignmentsOf(a);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ status: 'NOT_STARTED' });
    expect((await lessonsOf(a))[0]).toMatchObject({ stage: 'ASSIGNED', aiMode: 'SEEDED' });
  });

  it('two workspaces restore s01 with no shared IDs', async () => {
    const [one] = await assignmentsOf(a);
    const [two] = await assignmentsOf(b);
    expect(one?.assignmentId).not.toBe(two?.assignmentId);
    expect(one?.assignmentId).not.toBe(assignmentId);
  });

  it('a student can take the copied set', async () => {
    const [assignment] = await assignmentsOf(a);
    const attempt = (await (await a.post(`/assignments/${assignment!.assignmentId}/attempts`)).json()) as { attemptId: string };
    const task = (await (await a.get(`/attempts/${attempt.attemptId}/tasks/Q1`)).json()) as { answers: { id: string }[]; evidence: { id: string }[] };
    const lock = await a.post(`/attempts/${attempt.attemptId}/tasks/Q1/lock`, { artifact: { slot: 'Q1', answerId: task.answers[1]!.id, evidenceId: task.evidence[2]!.id }, initialConfidence: 70 });
    expect(lock.status).toBe(200);
  });
});

describe('demo menu', () => {
  it('simulate class on a seeded lesson submits 7 attempts marked simulated', async () => {
    const [assignment] = await assignmentsOf(b);
    expect((await b.post('/demo/simulate-class', { assignmentId: assignment!.assignmentId })).status).toBe(200);
    const tracking = ClassTrackingDTO.parse(await (await b.get(`/assignments/${assignment!.assignmentId}/tracking`)).json());
    expect(tracking.counts).toEqual({ started: 7, complete: 7 });
    expect(tracking.participants.every((p) => p.isSimulated && p.participantCode?.startsWith('P-SIM'))).toBe(true);
  });

  it('a repeat Simulate class press adds nothing', async () => {
    const [assignment] = await assignmentsOf(b);
    await b.post('/demo/simulate-class', { assignmentId: assignment!.assignmentId });
    const tracking = ClassTrackingDTO.parse(await (await b.get(`/assignments/${assignment!.assignmentId}/tracking`)).json());
    expect(tracking.counts.started).toBe(7);
  });

  it('fail-next-rerun does not affect another workspace', async () => {
    expect((await a.post('/demo/fail-next-rerun')).status).toBe(200);
    expect((await h.live.db.doc(`schools/${a.workspace.schoolId}`).get()).data()?.failNextRerun).toBe(true);
    expect((await h.live.db.doc(`schools/${b.workspace.schoolId}`).get()).data()?.failNextRerun).toBeUndefined();
  });

  it('reset in one workspace leaves the other intact and restores the ready set', async () => {
    const before = await lessonsOf(b);
    const [old] = await assignmentsOf(a);
    await a.post('/lessons', { title: 'Mine', subject: 'S', topic: 'T', level: 'basic', primaryClassId: a.workspace.classId, objective: 'O' });
    expect((await a.post('/demo/reset')).status).toBe(200);
    const lessons = await lessonsOf(a);
    expect(lessons.map((l) => l.title)).not.toContain('Mine');
    expect(await assignmentsOf(a)).toHaveLength(1);
    expect((await assignmentsOf(a))[0]?.status).toBe('NOT_STARTED');
    expect((await assignmentsOf(a))[0]?.assignmentId).toBe(old?.assignmentId);
    expect((await lessonsOf(b)).map((l) => l.id)).toEqual(before.map((l) => l.id));
  });

  it('reset keeps researchRows and participants', async () => {
    await h.live.db.doc(`participants/${a.session.uid}`).set({ consent: 'AGREED', consentVersion: '2026-10-v1' });
    await a.post('/demo/reset');
    expect((await h.live.db.doc(`participants/${a.session.uid}`).get()).exists).toBe(true);
    await h.live.db.doc(`participants/${a.session.uid}`).delete();
  });

  it('demo routes are 404 when DEMO_MODE=false', async () => {
    const off = await harness({ demoMode: false });
    const client = await off.client();
    expect((await client.post('/demo/reset')).status).toBe(404);
    await off.close();
  });
});
