import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssignmentListDTO, ClassTrackingDTO, LessonListDTO } from '@logina/contracts';
import { captureSnapshot, deleteSnapshot, snapshotId } from '@logina/db';
import { finishApproval, runDemoPath, type StepId } from '../../../tools/seed/demo-path.js';
import { harness, type Client, type Harness } from './helpers.js';

const RUN = `run${Date.now()}`;
const stepOf = (step: StepId) => `${RUN}${step}`;

let h: Harness;
let seed: Client;
let judge: Client;
let other: Client;
let assignmentId: string;
const steps: StepId[] = [];

const restore = (client: Client, step: StepId) => client.post(`/demo/snapshots/${stepOf(step)}/restore`);
const lessonOf = async (client: Client) => LessonListDTO.parse(await (await client.get('/lessons')).json()).lessons[0]!.id;
const jobIds = async (client: Client) => (await h.live.db.collection('jobs').where('schoolId', '==', client.workspace.schoolId).get()).docs.map((d) => d.id);

beforeAll(async () => {
  h = await harness({ researchEnabled: false, readySnapshot: snapshotId('en', stepOf('s01')), snapshotLocale: 'en' }, {}, { runJobs: true });
  seed = await h.client({ skipCopy: true });
  ({ assignmentId } = await runDemoPath(seed, 'en', async (step) => {
    steps.push(step);
    await captureSnapshot(h.live.db, snapshotId('en', stepOf(step)), { schoolId: seed.workspace.schoolId, label: step });
  }));
  [judge, other] = await Promise.all([h.client(), h.client()]);
}, 280_000);

afterAll(async () => {
  await Promise.all((['t07', 't12', 's01', 't14'] as const).map((step) => deleteSnapshot(h.live.db, snapshotId('en', stepOf(step)))));
  await h.close();
});

describe('demo path', () => {
  it('captures every step in demo order', () => {
    expect(steps).toEqual(['t07', 't12', 's01', 't14']);
  });

  it('the releases carry the draft versions the demo shows', async () => {
    const { lessonId } = (await h.live.db.doc(`assignments/${assignmentId}`).get()).data()!;
    const releases = await h.live.db.collection(`lessons/${lessonId}/taskReleases`).get();
    const bySlot = Object.fromEntries(releases.docs.map((d) => [d.data().slot, d.data().releaseLabel]));
    expect(bySlot).toEqual({ Q1: 'r4', Q2: 'r2', Q3: 'r2', Q4: 'r4', Q5: 'r3' });
  });

  it('writes no research rows', async () => {
    const rows = await h.live.db.collection('researchRows').where('assignment_id', '==', assignmentId).get();
    expect(rows.empty).toBe(true);
  });

  it('s01 holds no attempts, t14 holds the 8 finished ones', async () => {
    expect((await h.live.db.collection('attempts').where('schoolId', '==', judge.workspace.schoolId).get()).empty).toBe(true);
    expect((await restore(judge, 't14')).status).toBe(200);
    const [assignment] = AssignmentListDTO.parse(await (await judge.get('/me/assignments')).json()).assignments;
    const tracking = ClassTrackingDTO.parse(await (await judge.get(`/assignments/${assignment!.assignmentId}/tracking`)).json());
    expect(tracking.counts).toEqual({ started: 8, complete: 8 });
  });

  it('two workspaces restoring one step share no job IDs', async () => {
    await Promise.all([restore(judge, 't07'), restore(other, 't07')]);
    const [mine, theirs] = await Promise.all([jobIds(judge), jobIds(other)]);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.filter((id) => theirs.includes(id))).toEqual([]);
  });

  it('a copy of t12 passes the real approval guards and can be assigned', async () => {
    expect((await restore(other, 't12')).status).toBe(200);
    const response = await finishApproval(other, await lessonOf(other), 'en');
    expect(response.assignmentId).toBeTruthy();
  }, 120_000);
});
