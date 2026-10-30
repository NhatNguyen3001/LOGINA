import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChallengeListDTO,
  JobDTO,
  TasksOverviewDTO,
  TeacherLogicReviewDTO,
  TeacherTaskPreviewDTO,
  TeacherTaskSummaryDTO,
  TryCaseDTO,
  findRestrictedKeys,
} from '@logina/contracts';
import { harness, seedGenerated, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let lessonId: string;

const base = () => `/lessons/${lessonId}/tasks`;

beforeAll(async () => {
  h = await harness({}, {}, { runJobs: ['GENERATE'] });
  a = await h.client();
  lessonId = await seedGenerated(h, a);
});

afterAll(async () => {
  await h.close();
});

describe('task overview and previews', () => {
  it('tasks overview lists five slots with sufficiency, sourceRefs and draftStatus', async () => {
    const { slots } = TasksOverviewDTO.parse(await (await a.get(base())).json());
    expect(slots.map((s) => s.slot)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(slots[0]).toMatchObject({ sufficiency: 'SUFFICIENT', draftStatus: 'REVIEW_REQUIRED' });
    expect(slots[3]).toMatchObject({ sufficiency: 'UNCERTAIN', draftStatus: null });
    expect(slots[0]?.sourceRefs.length).toBeGreaterThan(0);
  });

  it('Q1 preview has labels, gates, the inline finding and example prompts', async () => {
    const preview = TeacherTaskPreviewDTO.parse(await (await a.get(`${base()}/Q1/preview`)).json());
    expect(preview.answers).toHaveLength(4);
    expect(preview.evidence).toHaveLength(4);
    expect(preview.exampleChallenges.length).toBeLessThanOrEqual(3);
    expect(preview.gates).toHaveLength(6);
    expect(preview.answers.find((x) => x.id === 'A4')?.inlineFinding).toMatchObject({ gateId: 'QG3' });
    expect(preview.draftVersion).toBe(3);
    expect(preview.previewHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('FE04 Q2–Q5 summary carries 1 to 3 example challenges, not the full list', async () => {
    const summary = TeacherTaskSummaryDTO.parse(await (await a.get(`${base()}/Q2/preview`)).json());
    expect(summary.exampleChallenges.length).toBeGreaterThanOrEqual(1);
    expect(summary.exampleChallenges.length).toBeLessThanOrEqual(3);
  });

  it('X04 FE04 basic preview has no 16-pair grid or predicates', async () => {
    const raw = await (await a.get(`${base()}/Q1/preview`)).json();
    expect(raw).not.toHaveProperty('pairs');
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('a Q2 summary never carries accepted orders', async () => {
    const raw = await (await a.get(`${base()}/Q2/preview`)).json();
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('preview GET records previewViews for the viewer', async () => {
    const preview = TeacherTaskPreviewDTO.parse(await (await a.get(`${base()}/Q1/preview`)).json());
    const doc = await h.live.db.doc(`previewViews/${a.workspace.teacherUid}_${preview.draftId}`).get();
    expect(doc.data()).toMatchObject({ previewHash: preview.previewHash, schoolId: a.workspace.schoolId });
  });

  it('a slot with no draft is 404', async () => {
    expect((await a.get(`${base()}/Q4/preview`)).status).toBe(404);
  });

  it('another workspace gets 404', async () => {
    const b = await h.client();
    expect((await b.get(`${base()}/Q1/preview`)).status).toBe(404);
  });
});

describe('challenges, try-case and logic review', () => {
  it('QA16 P0-02 challenge list returns every candidate and the fallback with candidateSetVersion', async () => {
    const list = ChallengeListDTO.parse(await (await a.get(`${base()}/Q1/challenges`)).json());
    expect(list.challenges).toHaveLength(5);
    expect(list.challenges.filter((c) => c.isFallback)).toHaveLength(1);
    expect(list.candidateSetVersion).toBe(1);
  });

  it('SEC04 challenge list passes the restricted scan', async () => {
    expect(findRestrictedKeys(await (await a.get(`${base()}/Q1/challenges`)).json(), 'teacher')).toEqual([]);
  });

  it('FE05 logic review lists all 16 pairs and every candidate, no rule objects', async () => {
    const raw = await (await a.get(`${base()}/Q1/logic-review`)).json();
    const review = TeacherLogicReviewDTO.parse(raw);
    expect(review.pairs).toHaveLength(16);
    expect(review.challenges).toHaveLength(5);
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('logic review is Q1 only', async () => {
    expect((await a.get(`${base()}/Q2/logic-review`)).status).toBe(404);
  });

  it('try-case A2+E3 returns TN1 message without rule or rank', async () => {
    const raw = await (await a.post(`${base()}/Q1/try-case`, { answerId: 'A2', evidenceId: 'E3' })).json();
    const result = TryCaseDTO.parse(raw);
    expect(result.wouldReceive.label).toBe('TN1');
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('try-case A1+E1 gets the fallback', async () => {
    const result = TryCaseDTO.parse(await (await a.post(`${base()}/Q1/try-case`, { answerId: 'A1', evidenceId: 'E1' })).json());
    expect(result.wouldReceive.message).toBeTruthy();
  });
});

describe('sufficiency choice', () => {
  const version = async () => ((await (await a.get(`/lessons/${lessonId}`)).json()) as { version: number }).version;

  it('a choice that regenerates nothing leaves no job running', async () => {
    const version = (await h.live.db.doc(`lessons/${lessonId}`).get()).data()?.version as number;
    const response = await a.post(`${base()}/Q4/sufficiency-choice`, { choice: 'LEAVE_EMPTY', baseVersion: version });
    expect(JobDTO.parse(await response.json()).status).toBe('DONE');
    expect((await h.live.db.doc(`lessons/${lessonId}`).get()).data()?.activeJobId).toBeUndefined();
  });

  it('sufficiency-choice with a stale LessonDTO.version is 409', async () => {
    expect((await a.post(`${base()}/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: 999 })).status).toBe(409);
  });

  it('QA02 sufficiency REFOCUS regenerates Q4 only and returns JobDTO', async () => {
    const before = await (await a.get(base())).json();
    const job = JobDTO.parse(await (await a.post(`${base()}/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: await version() })).json());
    expect(job.type).toBe('GENERATE');
    expect(h.enqueued).toContainEqual(expect.objectContaining({ jobId: job.id, targetIds: ['Q4'] }));
    const { slots } = TasksOverviewDTO.parse(await (await a.get(base())).json());
    expect(slots[3]).toMatchObject({ draftStatus: 'BLOCKED' });
    expect(slots[0]?.draftId).toBe(TasksOverviewDTO.parse(before).slots[0]?.draftId);
  });
});
