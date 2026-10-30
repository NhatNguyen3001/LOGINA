import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EditResultDTO, SourceDraftDTO, TasksOverviewDTO, TeacherTaskPreviewDTO } from '@logina/contracts';
import { loadFixture } from '@logina/domain';
import { harness, seedGenerated, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;

interface Target {
  lessonId: string;
  draftId: string;
  draftVersion: number;
}

const scripted = loadFixture('scripted-edits', 'en') as { id: string; payload: { text?: string; message?: string } }[];
const a4Text = scripted.find((e) => e.id === 'q1-a4-reword')!.payload.text!;

const draftOf = async (lessonId: string, slot: string) =>
  (await h.live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds[slot] as string;
const status = async (lessonId: string, draftId: string) =>
  (await h.live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()?.status;

const edit = (t: Target, overrides: object, key?: string) =>
  a.post(
    `/lessons/${t.lessonId}/edits`,
    { editScope: 'CONTENT', targetType: 'answerOption', targetId: t.draftId, changedRefs: ['A4'], baseVersion: t.draftVersion, ...overrides },
    key,
  );

let target: () => Promise<Target>;
const contentEdit = (text: string) => ({ payload: { optionId: 'A4', text } });

beforeAll(async () => {
  h = await harness({}, {}, { runJobs: ['GENERATE'] });
  a = await h.client();
  target = async () => {
    const lessonId = await seedGenerated(h, a);
    return { lessonId, draftId: await draftOf(lessonId, 'Q1'), draftVersion: 3 };
  };
});

afterAll(async () => {
  await h.close();
});

describe('edits', () => {
  it('R01 X05 X07 content edit creates new draft and marks old preview STALE before rerun', async () => {
    const t = await target();
    const result = EditResultDTO.parse(await (await edit(t, contentEdit(a4Text))).json());
    expect(result.newDraftIds).toHaveLength(1);
    expect(await status(t.lessonId, t.draftId)).toBe('STALE');
    const newest = (await h.live.db.doc(`lessons/${t.lessonId}/taskDrafts/${result.newDraftIds[0]}`).get()).data();
    expect(newest).toMatchObject({ draftVersion: 4, status: 'VALIDATING', parentDraftId: t.draftId });
    expect(newest?.answerOptions.find((x: { answerOptionId: string }) => x.answerOptionId === 'A4').text).toBe(a4Text);
    expect(await draftOf(t.lessonId, 'Q1')).toBe(result.newDraftIds[0]);
    expect((await h.live.db.doc(`jobs/${result.jobId}`).get()).data()).toMatchObject({ type: 'RERUN', targetIds: result.newDraftIds });
    expect((await h.live.db.doc(`lessons/${t.lessonId}`).get()).data()?.activeJobId).toBe(result.jobId);
  });

  it('X11 content edit adding a new fact is rejected with route SOURCE', async () => {
    const t = await target();
    const response = await edit(t, contentEdit('The share of workers in services fell by 5%.'));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'NEEDS_SOURCE_ROUTE', affectedRefs: ['A4'] });
    expect(await status(t.lessonId, t.draftId)).not.toBe('STALE');
  });

  it('R02 X08 logic edit leaves source model unchanged and changes the prompt', async () => {
    const t = await target();
    const before = (await h.live.db.doc(`lessons/${t.lessonId}`).get()).data()?.currentSourceModelVersionId;
    const result = EditResultDTO.parse(
      await (await edit(t, { editScope: 'LOGIC', targetType: 'challenge', changedRefs: ['TN2'], payload: { challengeId: 'TN2', message: 'A new prompt.' } })).json(),
    );
    const prompt = await h.live.db.doc(`lessons/${t.lessonId}/taskDrafts/${result.newDraftIds[0]}/challengeCandidates/TN2`).get();
    expect(prompt.data()?.message).toBe('A new prompt.');
    expect((await h.live.db.doc(`lessons/${t.lessonId}`).get()).data()?.currentSourceModelVersionId).toBe(before);
  });

  it('R05 retry with same key returns same draft id', async () => {
    const t = await target();
    const key = randomUUID();
    const first = EditResultDTO.parse(await (await edit(t, contentEdit(a4Text), key)).json());
    const second = EditResultDTO.parse(await (await edit(t, contentEdit(a4Text), key)).json());
    expect(second.newDraftIds).toEqual(first.newDraftIds);
  });

  it('R06 concurrent edits on same base: one 200, one 409', async () => {
    const t = await target();
    const results = await Promise.all([edit(t, contentEdit(a4Text)), edit(t, contentEdit('Another wording of the statement.'))]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('QA15 VC07 unrelated tasks keep status', async () => {
    const t = await target();
    const q2 = await draftOf(t.lessonId, 'Q2');
    const before = await status(t.lessonId, q2);
    await edit(t, contentEdit(a4Text));
    expect(await status(t.lessonId, q2)).toBe(before);
  });

  it('edit without baseVersion is 400', async () => {
    const t = await target();
    const response = await a.post(`/lessons/${t.lessonId}/edits`, { editScope: 'CONTENT', targetType: 'a', targetId: t.draftId, changedRefs: [], payload: { optionId: 'A4', text: 'x' } });
    expect(response.status).toBe(400);
  });

  it('a draft from another lesson is 404', async () => {
    const t = await target();
    expect((await edit({ ...t, draftId: 'nope' }, contentEdit(a4Text))).status).toBe(404);
  });
});

describe('rerun route', () => {
  it('Try again restarts a FAILED draft', async () => {
    const t = await target();
    await h.live.db.doc(`lessons/${t.lessonId}/taskDrafts/${t.draftId}`).update({ status: 'FAILED' });
    const response = await a.post(`/lessons/${t.lessonId}/tasks/Q1/rerun`);
    expect(response.status).toBe(200);
    expect(await status(t.lessonId, t.draftId)).toBe('VALIDATING');
  });

  it('rerun on a draft that is not FAILED is 409', async () => {
    const t = await target();
    expect((await a.post(`/lessons/${t.lessonId}/tasks/Q1/rerun`)).status).toBe(409);
  });
});

describe('source edits', () => {
  it('R03 X09 source edit marks only dependent tasks and reports impact on T10', async () => {
    const t = await target();
    const { version } = (await (await a.get(`/lessons/${t.lessonId}/source-review`)).json()) as { version: number };
    const response = await edit(t, {
      editScope: 'SOURCE',
      targetType: 'claim',
      targetId: 'c1',
      changedRefs: ['c1'],
      baseVersion: version,
      payload: { claimId: 'c1', wording: 'A new claim wording.', evidenceIds: ['se1'] },
    });
    expect(response.status).toBe(200);
    expect((await h.live.db.doc(`lessons/${t.lessonId}`).get()).data()?.stage).toBe('SOURCE_REVIEW');
    const draft = SourceDraftDTO.parse(await (await a.get(`/lessons/${t.lessonId}/source-draft`)).json());
    expect(draft.editedClaims[0]).toMatchObject({ claimId: 'c1', after: 'A new claim wording.' });
    expect(draft.impact.filter((i) => i.usesClaim).map((i) => i.slot)).toEqual(['Q1', 'Q2']);
    expect(draft.unaffectedSlots).toEqual(['Q3', 'Q5']);
    const { slots } = TasksOverviewDTO.parse(await (await a.get(`/lessons/${t.lessonId}/tasks`)).json());
    expect(slots.find((s) => s.slot === 'Q1')?.draftStatus).toBe('STALE');
    expect(slots.find((s) => s.slot === 'Q3')?.draftStatus).toBe('MACHINE_PASS');
  });

  it('a preview after a content edit shows the new wording', async () => {
    const t = await target();
    await edit(t, contentEdit(a4Text));
    const preview = TeacherTaskPreviewDTO.parse(await (await a.get(`/lessons/${t.lessonId}/tasks/Q1/preview`)).json());
    expect(preview.answers.find((x) => x.id === 'A4')?.text).toBe(a4Text);
    expect(preview.canApprove).toBe(false);
  });
});
