import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApproveResultDTO, AssignResultDTO, AssignmentListDTO, TaskApprovalDTO, TeacherTaskPreviewDTO, TeacherTaskSummaryDTO, findRestrictedKeys } from '@logina/contracts';
import { loadFixture } from '@logina/domain';
import { harness, seedGenerated, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let lessonId: string;

const fix = (loadFixture('scripted-edits', 'en') as { id: string; payload: { challengeId: string; message: string } }[]).find((e) => e.id === 'q4-tn2-fix')!;
const lessonUrl = () => `/lessons/${lessonId}`;
const approval = async () => TaskApprovalDTO.parse(await (await a.get(`${lessonUrl()}/approval`)).json());
const version = async () => ((await (await a.get(lessonUrl())).json()) as { version: number }).version;

async function preview(slot: string) {
  const raw = await (await a.get(`${lessonUrl()}/tasks/${slot}/preview`)).json();
  return (slot === 'Q1' ? TeacherTaskPreviewDTO.parse(raw) : TeacherTaskSummaryDTO.parse(raw)) as { draftVersion: number };
}

const approveBody = async (slot: string) => {
  await preview(slot);
  const task = (await approval()).tasks.find((t) => t.slot === slot)!;
  return { expectedDraftVersion: task.draftVersion, previewHash: task.previewHash, candidateSetVersion: task.candidateSetVersion, confirmed: true };
};
const approve = (slot: string, body: object) => a.post(`${lessonUrl()}/tasks/${slot}/approve`, body);

beforeAll(async () => {
  h = await harness({}, {}, { runJobs: ['GENERATE', 'RERUN'] });
  a = await h.client();
  lessonId = await seedGenerated(h, a);
  await a.post(`${lessonUrl()}/tasks/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: await version() });
}, 180_000);

afterAll(async () => {
  await h.close();
});

describe('Task Approval 2', () => {
  it('approval overview lists five tasks', async () => {
    const { tasks } = await approval();
    expect(tasks.map((t) => t.slot)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(tasks[0]?.decisionsNeeded[0]).toMatchObject({ gateId: 'QG3' });
    expect(findRestrictedKeys(await (await a.get(`${lessonUrl()}/approval`)).json(), 'teacher')).toEqual([]);
  });

  it('R04 approve with stale draftVersion rejected', async () => {
    const response = await approve('Q2', { ...(await approveBody('Q2')), expectedDraftVersion: 1 });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'STALE_VERSION' });
  });

  it('VC09 a changed preview hash is rejected and no release is written', async () => {
    const response = await approve('Q2', { ...(await approveBody('Q2')), previewHash: 'old' });
    expect(response.status).toBe(409);
    expect((await h.live.db.collection(`lessons/${lessonId}/taskReleases`).get()).empty).toBe(true);
  });

  it('QA16 approve with an old candidateSetVersion is rejected', async () => {
    const response = await approve('Q2', { ...(await approveBody('Q2')), candidateSetVersion: 99 });
    expect(response.status).toBe(409);
  });

  it('QA13 VC11 BLOCKER cannot be accepted', async () => {
    const task = (await approval()).tasks.find((t) => t.slot === 'Q4')!;
    await a.post(`${lessonUrl()}/tasks/Q4/dispositions`, { gateId: 'QG5', findingCode: 'ANSWER_LEAKAGE', decision: 'TEACHER_ACCEPT_WITH_REASON', reason: 'Fine', baseVersion: task.draftVersion });
    const response = await approve('Q4', await approveBody('Q4'));
    expect(response.status).toBe(409);
  });

  it('dispositions with a stale draftVersion are 409', async () => {
    const response = await a.post(`${lessonUrl()}/tasks/Q1/dispositions`, { gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'TEACHER_ACCEPT_WITH_REASON', reason: 'x', baseVersion: 1 });
    expect(response.status).toBe(409);
  });

  it('an undecided warning blocks approval', async () => {
    expect((await approve('Q1', await approveBody('Q1'))).status).toBe(409);
  });

  it('QA12 warning accepted with reason → approved, validator status stays REVIEW_REQUIRED', async () => {
    const task = (await approval()).tasks.find((t) => t.slot === 'Q1')!;
    await a.post(`${lessonUrl()}/tasks/Q1/dispositions`, { gateId: 'QG3', findingCode: 'DISTRACTOR_IMPLAUSIBLE', decision: 'TEACHER_ACCEPT_WITH_REASON', reason: 'Fits this class', baseVersion: task.draftVersion });
    const result = ApproveResultDTO.parse(await (await approve('Q1', await approveBody('Q1'))).json());
    expect(result.releaseLabel).toBe('r3');
    const updated = (await approval()).tasks.find((t) => t.slot === 'Q1');
    expect(updated).toMatchObject({ status: 'APPROVED', acceptedWarning: true, releaseLabel: 'r3' });
    expect(updated?.gatesSummary.aggregate).toBe('REVIEW_REQUIRED');
  });

  it('release publicContent uses displayOrder, IDs are opaque and maps stay server only', async () => {
    const releases = await h.live.db.collection(`lessons/${lessonId}/taskReleases`).get();
    const release = releases.docs.find((d) => d.data().slot === 'Q1')!.data();
    const letters = release.publicContent.answerOptions.map((x: { id: string }) => release.answerIdMap[x.id]);
    expect(letters).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(JSON.stringify(release.publicContent)).not.toMatch(/"A1"|"E1"|answerCorrectness|teacherLabel/);
    expect(release).toMatchObject({ status: 'ACTIVE', approvedBy: a.workspace.teacherUid, candidateSetVersion: 1 });
  });

  it('a second approval of the same draft is refused', async () => {
    expect((await approve('Q1', await approveBody('Q1'))).status).toBe(409);
  });
});

describe('assignments', () => {
  const assign = async (baseVersion?: number) =>
    a.post(`${lessonUrl()}/assignments`, { classId: a.workspace.classId, baseVersion: baseVersion ?? (await version()) });

  it('FE01 assign is blocked until all five tasks are approved', async () => {
    expect((await assign()).status).toBe(409);
  });

  it('Q4 TN2 logic edit takes Q4 from BLOCKED v3 to MACHINE_PASS v4, then all five approve', async () => {
    const q4 = (await approval()).tasks.find((t) => t.slot === 'Q4')!;
    const draftId = (await h.live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q4;
    await a.post(`${lessonUrl()}/edits`, { editScope: 'LOGIC', targetType: 'challenge', targetId: draftId, changedRefs: ['TN2'], baseVersion: q4.draftVersion, payload: fix.payload });
    const after = (await approval()).tasks.find((t) => t.slot === 'Q4')!;
    expect(after).toMatchObject({ draftVersion: 4, status: 'MACHINE_PASS' });
    for (const slot of ['Q2', 'Q3', 'Q4', 'Q5']) {
      expect((await approve(slot, await approveBody(slot))).status).toBe(200);
    }
  });

  it('assign with a stale LessonDTO.version is 409', async () => {
    expect((await assign(999)).status).toBe(409);
  });

  it('assign pins release ids and asks for no approval fields', async () => {
    const result = AssignResultDTO.parse(await (await assign()).json());
    expect(result).toMatchObject({ revision: 1, releaseLabels: { Q1: 'r3', Q2: 'r2', Q3: 'r2', Q4: 'r4', Q5: 'r3' } });
    const doc = (await h.live.db.doc(`assignments/${result.assignmentId}`).get()).data();
    expect(doc).toMatchObject({ openAccess: true, schoolId: a.workspace.schoolId, revision: 1 });
    expect(Object.keys(doc?.releaseIds).sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect((await h.live.db.doc(`lessons/${lessonId}`).get()).data()).toMatchObject({ stage: 'ASSIGNED', latestAssignmentId: result.assignmentId });
  });

  it('PUB01 a second assign is a new revision', async () => {
    const result = AssignResultDTO.parse(await (await assign()).json());
    expect(result.revision).toBe(2);
  });

  it('GET /me/assignments lists the newest first for this workspace only', async () => {
    const { assignments } = AssignmentListDTO.parse(await (await a.get('/me/assignments')).json());
    expect(assignments).toHaveLength(2);
    expect(assignments[0]).toMatchObject({ lessonTitle: 'Seeded', teacherName: 'Ms. Lan', status: 'NOT_STARTED' });
    const b = await h.client();
    expect(AssignmentListDTO.parse(await (await b.get('/me/assignments')).json()).assignments).toEqual([]);
  });
});
