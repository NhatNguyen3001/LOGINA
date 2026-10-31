import { decodeNested } from '@logina/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobDTO, TaskApprovalDTO } from '@logina/contracts';
import { textsFor } from '../src/services/localize.js';
import { harness, seedGenerated, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let lessonId: string;

const url = () => `/lessons/${lessonId}`;
const lesson = () => h.live.db.doc(`lessons/${lessonId}`);
const translation = (slot: string) => lesson().collection('taskTranslations').doc(slot);
const approval = async () => TaskApprovalDTO.parse(await (await a.get(`${url()}/approval`)).json());
const version = async () => (await lesson().get()).data()?.version as number;

const approveBody = async (slot: string) => {
  await a.get(`${url()}/tasks/${slot}/preview`);
  const task = (await approval()).tasks.find((t) => t.slot === slot)!;
  return { expectedDraftVersion: task.draftVersion, previewHash: task.previewHash, candidateSetVersion: task.candidateSetVersion, confirmed: true, translationVersion: task.translation?.version };
};
const approve = async (slot: string) => a.post(`${url()}/tasks/${slot}/approve`, await approveBody(slot));

const stored = async (slot: string, fields: object) => {
  const draft = (await lesson().get()).data()?.currentTaskDraftIds[slot] as string;
  const stem = (await lesson().collection('taskDrafts').doc(draft).get()).data()?.questionStem as string;
  await translation(slot).set({ slot, draftId: draft, locale: 'vi', status: 'READY', version: 1, texts: [{ from: stem, to: `vi ${stem}` }], keywords: {}, findings: [], ...fields });
  return stem;
};

beforeAll(async () => {
  h = await harness({}, {}, { runJobs: ['GENERATE', 'RERUN'] });
  a = await h.client();
  lessonId = await seedGenerated(h, a);
  await a.post(`${url()}/tasks/Q4/sufficiency-choice`, { choice: 'REFOCUS', baseVersion: await version() });
  await lesson().update({ aiMode: 'LIVE' });
}, 180_000);

afterAll(async () => {
  await h.close();
});

describe('translation at Approval 2', () => {
  it('a missing translation stops approval', async () => {
    const response = await approve('Q5');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'TRANSLATION_NOT_READY' });
  });

  it.each(['FAILED', 'BLOCKED', 'WORKING'])('a %s translation stops approval', async (status) => {
    await stored('Q5', { status });
    expect((await approve('Q5')).status).toBe(409);
  });

  it('a review finding needs a decision, then approval goes through', async () => {
    await stored('Q5', { status: 'NEEDS_REVIEW', findings: [{ status: 'REVIEW_REQUIRED', findingCode: 'MEANING_SHIFT', text: 'x', explanationForTeacher: 'Check this line.' }] });
    const task = (await approval()).tasks.find((t) => t.slot === 'Q5')!;
    expect(task.translation?.findings[0]?.findingCode).toBe('MEANING_SHIFT');
    expect(task.decisionsNeeded).toContainEqual(expect.objectContaining({ gateId: 'TRANSLATION', findingCode: 'MEANING_SHIFT' }));
    const body = await approveBody('Q5');
    expect((await a.post(`${url()}/tasks/Q5/approve`, body)).status).toBe(409);
    await a.post(`${url()}/tasks/Q5/dispositions`, { decision: 'TEACHER_ACCEPT_WITH_REASON', gateId: 'TRANSLATION', findingCode: 'MEANING_SHIFT', reason: 'Reads fine', baseVersion: task.draftVersion });
    await translation('Q5').update({ keywords: { training: ['đào tạo'] } });
    expect((await a.post(`${url()}/tasks/Q5/approve`, body)).status).toBe(200);
  });

  it('approval copies the pairs and merges the keywords into the release', async () => {
    const draft = (await lesson().get()).data()?.currentTaskDraftIds.Q5 as string;
    const release = decodeNested((await lesson().collection('taskReleases').doc(`rel_${draft}`).get()).data()!);
    expect(release.translations.vi[0].to).toMatch(/^vi /);
    expect(release.serverBody.keywordPartitions.training).toEqual(expect.arrayContaining(['training', 'đào tạo']));
  });

  it('a translation for an older draft cannot be approved', async () => {
    const stem = await stored('Q4', { draftId: 'tdr_old' });
    expect(stem).toBeDefined();
    const response = await approve('Q4');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'TRANSLATION_NOT_READY' });
  });

  it('a decision other than accepting does not clear a finding', async () => {
    await stored('Q4', { status: 'NEEDS_REVIEW', findings: [{ status: 'REVIEW_REQUIRED', findingCode: 'v1-0-SHIFT', text: 'x', explanationForTeacher: 'y' }] });
    const task = (await approval()).tasks.find((t) => t.slot === 'Q4')!;
    await a.post(`${url()}/tasks/Q4/dispositions`, { decision: 'REVISE_AND_RERUN', gateId: 'TRANSLATION', findingCode: 'v1-0-SHIFT', baseVersion: task.draftVersion });
    const response = await approve('Q4');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'UNDISPOSITIONED_REVIEW' });
  });

  it('an edit is refused while the translation is being worked on', async () => {
    const stem = await stored('Q3', { status: 'WORKING' });
    expect((await a.post(`${url()}/tasks/Q3/translation`, { from: stem, to: 'x', translationVersion: 1 })).status).toBe(409);
  });

  it('an edit to a line that is not in the translation is refused', async () => {
    await stored('Q3', {});
    expect((await a.post(`${url()}/tasks/Q3/translation`, { from: 'nope', to: 'x', translationVersion: 1 })).status).toBe(404);
  });

  it('retry is refused on a healthy translation', async () => {
    await stored('Q3', {});
    expect((await a.post(`${url()}/tasks/Q3/translation/retry`)).status).toBe(409);
  });

  it('a stuck translation can be retried', async () => {
    await stored('Q3', { status: 'WORKING', updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
    const task = (await approval()).tasks.find((t) => t.slot === 'Q3')!;
    expect(task.translation?.stuck).toBe(true);
    expect((await a.post(`${url()}/tasks/Q3/translation/retry`)).status).toBe(200);
  });

  it('a blocked translation retries from scratch', async () => {
    await stored('Q3', { status: 'BLOCKED' });
    await a.post(`${url()}/tasks/Q3/translation/retry`);
    const job = h.enqueued.at(-1)!;
    expect((await h.live.db.doc(`jobs/${job.jobId}`).get()).data()?.fresh).toBe(true);
  });

  it('a stale translation version is rejected', async () => {
    await stored('Q3', { version: 2 });
    const body = { ...(await approveBody('Q3')), translationVersion: 1 };
    expect((await a.post(`${url()}/tasks/Q3/approve`, body)).status).toBe(409);
  });

  it('a teacher edit changes the line and sends it to the check', async () => {
    const stem = await stored('Q2', {});
    const response = await a.post(`${url()}/tasks/Q2/translation`, { from: stem, to: 'Câu hỏi của cô', translationVersion: 1 });
    expect(JobDTO.parse(await response.json()).type).toBe('TRANSLATE');
    expect(h.enqueued).toContainEqual(expect.objectContaining({ type: 'TRANSLATE', targetIds: ['Q2'] }));
    expect((await translation('Q2').get()).data()).toMatchObject({ status: 'WORKING', version: 2, texts: [{ from: stem, to: 'Câu hỏi của cô' }] });
  });

  it('retry queues the task again', async () => {
    await stored('Q1', { status: 'FAILED', texts: [] });
    const response = await a.post(`${url()}/tasks/Q1/translation/retry`);
    expect(JobDTO.parse(await response.json()).type).toBe('TRANSLATE');
    expect((await translation('Q1').get()).data()?.status).toBe('WORKING');
  });

  it('a lesson mixing translated and untranslated releases cannot be assigned', async () => {
    const release = lesson().collection('taskReleases');
    const all = await release.get();
    const ids = (await lesson().get()).data()?.currentTaskDraftIds as Record<string, string>;
    await Promise.all(Object.values(ids).filter((id) => !all.docs.some((d) => d.id === `rel_${id}`)).map((id) => release.doc(`rel_${id}`).set({ taskDraftId: id, status: 'ACTIVE' })));
    const classId = (await lesson().get()).data()?.primaryClassId as string;
    const response = await a.post(`${url()}/assignments`, { classId, baseVersion: await version() });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'TRANSLATION_MIXED' });
  });
});

describe('the sample lesson', () => {
  it('has no translation job, and approval never copies a stray document', async () => {
    await lesson().update({ aiMode: 'SEEDED' });
    expect((await a.post(`${url()}/tasks/Q1/translation/retry`)).status).toBe(409);
    await lesson().update({ aiMode: 'LIVE' });
  });
});

describe('what a student gets', () => {
  const release = { translations: { vi: [{ from: 'Stem', to: 'Thân câu' }] } };

  it('an approved translation is used in the other language only', () => {
    expect(textsFor({ contentLocale: 'en', aiMode: 'LIVE' }, 'vi', release)).toEqual(release.translations.vi);
    expect(textsFor({ contentLocale: 'en', aiMode: 'LIVE' }, 'en', release)).toEqual([]);
  });

  it('an empty stored list does not switch off the sample lesson', () => {
    expect(textsFor({ contentLocale: 'en', aiMode: 'SEEDED' }, 'vi', { translations: { vi: [] } }).length).toBeGreaterThan(0);
  });

  it('an older uploaded lesson with no translation stays in its language', () => {
    expect(textsFor({ contentLocale: 'en', aiMode: 'LIVE' }, 'vi', {})).toEqual([]);
  });
});
