import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadFixture, type DraftFixture } from '@logina/domain';
import { liveSetup, testSchoolId, type LiveProject } from '@logina/test-utils';
import { z } from 'zod';
import { generateStructured, modelFor } from '../src/ai/model.js';
import { testWorkerConfig } from '../src/config.js';
import { createWorker, type WorkerDeps } from '../src/worker.js';
import * as docx from '../src/live/docx.js';
import { stubGenai, type StubGenai } from './fakes/genai.js';

let live: LiveProject;
const schoolId = testSchoolId();
const lessons: string[] = [];
const jobs: string[] = [];
const paragraph = 'The share of workers in farming fell from 49.5 percent to 29.1 percent over the period in this lesson.';
const reading = (language: string, text = paragraph) => ({
  language,
  pages: [{ n: 1, paragraphs: [{ k: 1, text }, { k: 2, text: `${text} Again.` }], tables: [{ k: 1, dataTable: [['a', 'b'], ['1', '2']] }], figures: [{ k: 1, altText: 'Chart' }] }],
});
const claim = (id: string, quote = '49.5 percent') => ({ id, wording: `Claim ${id}`, evidence: [{ locator: 'p1-1', quote }] });
const analysis = { claims: [claim('c1'), claim('c2'), claim('c3')], issues: [] };

let n = 0;
async function setup(fields: object = {}, material: object = {}): Promise<{ lessonId: string; jobId: string }> {
  n += 1;
  const lessonId = `les_${schoolId}_${n}`;
  const jobId = `job_${schoolId}_${n}`;
  lessons.push(lessonId);
  jobs.push(jobId);
  await live.db.doc(`lessons/${lessonId}`).set({
    schoolId, aiMode: 'LIVE', contentLocale: 'en', stage: 'CLARIFY', currentMaterialVersionId: 'mat_1', currentIntentVersionId: 'int_1', currentSourceModelVersionId: 'smv_1', currentTaskDraftIds: {}, activeJobId: jobId, ...fields,
  });
  await live.db.doc(`lessons/${lessonId}/materialVersions/mat_1`).set({ mimeType: 'application/pdf', storagePath: `uploads/${lessonId}/f.pdf`, parseStatus: 'PENDING', ...material });
  await live.db.doc(`jobs/${jobId}`).set({ schoolId, lessonId, type: 'PARSE', status: 'QUEUED', steps: [], targetIds: [] });
  return { lessonId, jobId };
}

const worker = (genai: StubGenai, overrides: Partial<WorkerDeps> = {}) =>
  createWorker({ db: live.db, bucket: live.bucket, genai, config: testWorkerConfig(), loadFixture, ...overrides });
const job = async (id: string) => (await live.db.doc(`jobs/${id}`).get()).data()!;
const docs = async (path: string) => (await live.db.collection(path).get()).docs;
const roleCalls = (genai: StubGenai, role: string) => genai.calls.filter((c) => c.role === role);
const textOf = (call: StubGenai['calls'][number]) => call.parts.map((p) => ('text' in p ? p.text : '')).join('\n');

beforeAll(async () => {
  live = await liveSetup();
});

afterAll(async () => {
  await Promise.all(lessons.map((id) => live.db.recursiveDelete(live.db.doc(`lessons/${id}`))));
  await Promise.all(jobs.map((id) => live.db.doc(`jobs/${id}`).delete()));
});

describe('live PARSE', () => {
  it('LIVE PARSE of a PDF sends the gs URI as fileData to READER_MODEL and writes readBy AI units', async () => {
    const genai = stubGenai({ reader: reading('en'), analyzer: analysis });
    const { lessonId, jobId } = await setup();
    await worker(genai).runJob(jobId);
    const [call] = roleCalls(genai, 'reader');
    expect(call?.model).toBe(testWorkerConfig().readerModel);
    expect(call?.parts).toContainEqual({ fileData: { fileUri: `gs://logina-dev-test/uploads/${lessonId}/f.pdf`, mimeType: 'application/pdf' } });
    const units = await docs(`lessons/${lessonId}/sourceUnits`);
    expect(units.map((u) => u.id).sort()).toEqual(['fig1-1', 'p1-1', 'p1-2', 't1-1']);
    expect(units.every((u) => u.data().readBy === 'AI')).toBe(true);
    expect(await job(jobId)).toMatchObject({ status: 'DONE' });
  });

  it('LIVE lesson never reads fixtures', async () => {
    const genai = stubGenai({ reader: reading('en'), analyzer: analysis });
    const spy = vi.fn(loadFixture);
    const { jobId } = await setup();
    await worker(genai, { loadFixture: spy }).runJob(jobId);
    expect(spy).not.toHaveBeenCalled();
  });

  it('SEEDED lesson never calls Gemini', async () => {
    const genai = stubGenai();
    const { jobId } = await setup({ aiMode: 'SEEDED' });
    await worker(genai).runJob(jobId);
    expect(genai.calls).toHaveLength(0);
  });

  it('SEEDED_AI=true override makes a LIVE lesson fail PARSE with LIVE_DISABLED', async () => {
    const genai = stubGenai();
    const { jobId } = await setup();
    await worker(genai, { config: testWorkerConfig({ seededAi: true }) }).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'FAILED', error: { code: 'LIVE_DISABLED' } });
    expect(genai.calls).toHaveLength(0);
  });

  it('reader output under 100 characters fails UNREADABLE', async () => {
    const { lessonId, jobId } = await setup();
    await worker(stubGenai({ reader: reading('en', 'x') })).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'FAILED', error: { code: 'UNREADABLE' } });
    expect((await live.db.doc(`lessons/${lessonId}/materialVersions/mat_1`).get()).data()).toMatchObject({ parseStatus: 'FAILED', refusal: { code: 'UNREADABLE' } });
  });

  it('detected language other fails UNSUPPORTED_LANGUAGE', async () => {
    const { jobId } = await setup();
    await worker(stubGenai({ reader: reading('other') })).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ error: { code: 'UNSUPPORTED_LANGUAGE' } });
  });

  it('DOCX over 6,000 words fails TOO_MANY_PAGES without calling Gemini', async () => {
    const convert = vi.spyOn(docx, 'docxToText').mockResolvedValue({ text: 'x', wordCount: 6001 });
    const genai = stubGenai();
    const { lessonId, jobId } = await setup({}, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await live.bucket.file(`uploads/${lessonId}/f.pdf`).save(Buffer.from('x'));
    await worker(genai).runJob(jobId);
    convert.mockRestore();
    expect(await job(jobId)).toMatchObject({ error: { code: 'TOO_MANY_PAGES' } });
    expect(genai.calls).toHaveLength(0);
  });

  it('a DOCX that mammoth cannot open fails UNREADABLE without calling Gemini', async () => {
    const genai = stubGenai();
    const { lessonId, jobId } = await setup({}, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await live.bucket.file(`uploads/${lessonId}/f.pdf`).save(Buffer.from('not a zip'));
    await worker(genai).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ error: { code: 'UNREADABLE' } });
    expect(genai.calls).toHaveLength(0);
  });

  it('LIVE PARSE of a DOCX sends text, not the file', async () => {
    const convert = vi.spyOn(docx, 'docxToText').mockResolvedValue({ text: 'Word text', wordCount: 2 });
    const genai = stubGenai({ reader: reading('en'), analyzer: analysis });
    const { lessonId, jobId } = await setup({}, { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await live.bucket.file(`uploads/${lessonId}/f.pdf`).save(Buffer.from('x'));
    await worker(genai).runJob(jobId);
    convert.mockRestore();
    const [call] = roleCalls(genai, 'reader');
    expect(call?.parts.some((p) => 'fileData' in p)).toBe(false);
    expect(textOf(call!)).toContain('Word text');
  });

  it('language mismatch pauses PARSE with NEEDS_INPUT and keeps activeJobId', async () => {
    const { lessonId, jobId } = await setup();
    await worker(stubGenai({ reader: reading('vi') })).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'NEEDS_INPUT', question: { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' } });
    expect((await live.db.doc(`lessons/${lessonId}`).get()).data()?.activeJobId).toBe(jobId);
  });

  it('answer resumes without a second reader call and continues to ANALYZE', async () => {
    const genai = stubGenai({ reader: reading('vi'), analyzer: analysis });
    const { jobId } = await setup();
    await worker(genai).runJob(jobId);
    await live.db.doc(`jobs/${jobId}`).update({ status: 'QUEUED', answer: 'KEEP_CHOSEN' });
    await worker(genai).runJob(jobId);
    expect(roleCalls(genai, 'reader')).toHaveLength(1);
    expect(roleCalls(genai, 'analyzer')).toHaveLength(1);
    expect(await job(jobId)).toMatchObject({ status: 'DONE' });
  });

  it('records readerVersion, detectedLocale and pageCount on the material version', async () => {
    const { lessonId, jobId } = await setup();
    await worker(stubGenai({ reader: reading('en'), analyzer: analysis })).runJob(jobId);
    expect((await live.db.doc(`lessons/${lessonId}/materialVersions/mat_1`).get()).data()).toMatchObject({ readerVersion: testWorkerConfig().readerModel, detectedLocale: 'en', pageCount: 1, parseStatus: 'DONE' });
  });
});

describe('live ANALYZE', () => {
  it('analyzer receives the numbered source units only', async () => {
    const genai = stubGenai({ reader: reading('en'), analyzer: analysis });
    const { jobId } = await setup();
    await worker(genai).runJob(jobId);
    const [call] = roleCalls(genai, 'analyzer');
    expect(call?.parts.some((p) => 'fileData' in p)).toBe(false);
    expect(textOf(call!)).toContain(`[p1-1] ${paragraph}`);
  });

  it('quote not found verbatim in the cited unit is dropped and raised as an issue', async () => {
    const invented = { ...analysis, claims: [...analysis.claims, claim('c4', '50.0 percent')] };
    const { lessonId, jobId } = await setup();
    await worker(stubGenai({ reader: reading('en'), analyzer: invented })).runJob(jobId);
    const issues = (await docs(`lessons/${lessonId}/clarificationIssues`)).map((d) => d.data());
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'BLOCKER', issueType: 'MISSING' });
    expect(issues[0]?.bubble).toContain('AI could not locate this in the source');
    expect((await docs(`lessons/${lessonId}/sourceClaims`)).map((d) => d.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('fewer than 3 claims with verified evidence fails TOO_LITTLE_CONTENT', async () => {
    const { jobId } = await setup();
    await worker(stubGenai({ reader: reading('en'), analyzer: { claims: [claim('c1')], issues: [] } })).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'FAILED', error: { code: 'TOO_LITTLE_CONTENT' } });
  });

  it('schema failure twice fails AI_FAILED', async () => {
    const genai = stubGenai({ reader: reading('en'), analyzer: { wrong: true } });
    const { jobId } = await setup();
    await worker(genai).runJob(jobId);
    expect(roleCalls(genai, 'analyzer')).toHaveLength(2);
    expect(await job(jobId)).toMatchObject({ error: { code: 'AI_FAILED' } });
  });

  it('with no issues the lesson goes straight to SOURCE_REVIEW', async () => {
    const { lessonId, jobId } = await setup();
    await worker(stubGenai({ reader: reading('en'), analyzer: analysis })).runJob(jobId);
    expect((await live.db.doc(`lessons/${lessonId}`).get()).data()?.stage).toBe('SOURCE_REVIEW');
  });
});

describe('live GENERATE and RERUN', () => {
  const q1 = loadFixture('q1-v4', 'en') as DraftFixture;
  const bundle = loadFixture('rule-bundles/q1', 'en');
  const gates = (status: string) => ['QG1', 'QG2', 'QG3', 'QG4', 'QG5', 'QG6'].map((gateId) => ({ gateId, status, findingCodes: [], sourceRefs: [], affectedArtifactIds: [], explanationForTeacher: 'x', overridable: status === 'REVIEW_REQUIRED' }));

  const setupGenerate = async () => {
    const context = await setup({ stage: 'GENERATE_PREVIEW' });
    await live.db.doc(`lessons/${context.lessonId}/sourceUnits/p1-1`).set({ text: q1.answerOptions!.map((a) => a.text).join(' ') + q1.generatedE!.map((e) => e.text).join(' ') });
    await live.db.doc(`jobs/${context.jobId}`).update({ type: 'GENERATE', targetIds: ['Q1'] });
    return context;
  };

  it('LIVE GENERATE calls generator then xreason, separately', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    const draftId = (await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1;
    expect((await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()?.status).toBe('MACHINE_PASS');
    expect(genai.calls.map((c) => c.role)).toEqual(['generator', 'xreason']);
    expect(textOf(roleCalls(genai, 'xreason')[0]!)).not.toContain('supportExtentRationaleX');
  });

  it('LIVE VALIDATE keeps an uncertain gate REVIEW_REQUIRED', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('REVIEW_REQUIRED') } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    const draftId = (await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1;
    expect((await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()?.status).toBe('REVIEW_REQUIRED');
  });

  it('LIVE GENERATE rejects a draft that adds a new fact', async () => {
    const draft = structuredClone(q1);
    draft.answerOptions![1]!.text = 'The share fell by 77 percent.';
    const genai = stubGenai({ generator: { draft, ruleBundle: bundle }, xreason: { gates: gates('PASS') } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    const draftId = (await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1;
    expect((await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()?.status).toBe('BLOCKED');
  });

  it('LIVE rerun failure returns REVIEW_REQUIRED Needs teacher review', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    const draftId = (await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1 as string;
    const rerunId = `${jobId}_r`;
    jobs.push(rerunId);
    await live.db.doc(`jobs/${rerunId}`).set({ schoolId, lessonId, type: 'RERUN', status: 'QUEUED', steps: [], targetIds: [draftId], edit: { editScope: 'CONTENT', payload: { optionId: 'A2', text: 'x' } } });
    const failing = stubGenai({ xreason: () => { throw new Error('down'); } });
    await worker(failing).runJob(rerunId);
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()!;
    expect(draft.status).toBe('REVIEW_REQUIRED');
    const report = (await live.db.doc(`lessons/${lessonId}/validationReports/${draft.latestValidationReportId}`).get()).data()!;
    expect(report.gates[0].explanationForTeacher).toBe('Needs teacher review');
  });
});

describe('generateStructured', () => {
  const schema = z.object({ ok: z.boolean() });

  it('picks READER_MODEL for reader, GENERATOR_MODEL for generator, XREASON_MODEL for analyzer and xreason', () => {
    const config = testWorkerConfig({ readerModel: 'r', generatorModel: 'g', xreasonModel: 'x' });
    expect(['reader', 'generator', 'analyzer', 'xreason'].map((role) => modelFor(role as 'reader', config))).toEqual(['r', 'g', 'x', 'x']);
  });

  it('retries once on schema failure then throws AI_FAILED', async () => {
    const genai = stubGenai({ reader: { nope: 1 } });
    await expect(generateStructured(genai, testWorkerConfig(), { role: 'reader', schema })).rejects.toMatchObject({ code: 'AI_FAILED' });
    expect(genai.calls).toHaveLength(2);
  });

  it('files become fileData parts and text becomes a text part', async () => {
    const genai = stubGenai({ reader: { ok: true } });
    await generateStructured(genai, testWorkerConfig(), { role: 'reader', schema, files: [{ gcsUri: 'gs://b/f', mimeType: 'application/pdf' }], text: 'hello' });
    expect(genai.calls[0]?.parts).toContainEqual({ fileData: { fileUri: 'gs://b/f', mimeType: 'application/pdf' } });
    expect(genai.calls[0]?.parts).toContainEqual({ text: 'hello' });
  });
});
