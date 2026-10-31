import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadFixture, studentTexts, type DraftFixture } from '@logina/domain';
import { liveSetup, testSchoolId, type LiveProject } from '@logina/test-utils';
import { z } from 'zod';
import { generateStructured, modelFor } from '../src/ai/model.js';
import { translateTask } from '../src/jobs/translate.js';
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
let cancelledJob = '';
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

describe('translateTask', () => {
  const q5 = loadFixture('q5', 'en') as DraftFixture;
  const texts = studentTexts(q5);
  const keywords = { training: ['đào tạo'] };
  const translator = { texts: texts.map((text) => `vi ${text}`), keywords };
  const run = async (genai: StubGenai, contentLocale = 'en') => {
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    const deps = { db: live.db, bucket: live.bucket, genai, config: testWorkerConfig(), loadFixture };
    await translateTask({ deps, lesson: { id, contentLocale } }, q5, 'tdr_1');
    return (await live.db.doc(`lessons/${id}/taskTranslations/Q5`).get()).data()!;
  };

  it('stores pairs and keywords, translator then check', async () => {
    const genai = stubGenai({ translator, translationCheck: { findings: [] } });
    const saved = await run(genai);
    expect(genai.calls.map((c) => c.role)).toEqual(['translator', 'translationCheck']);
    expect(saved).toMatchObject({ slot: 'Q5', draftId: 'tdr_1', locale: 'vi', status: 'READY', keywords, version: 1 });
    expect(saved.texts[0]).toEqual({ from: texts[0], to: `vi ${texts[0]}` });
  });

  it('a Vietnamese lesson translates into English', async () => {
    expect((await run(stubGenai({ translator, translationCheck: { findings: [] } }), 'vi')).locale).toBe('en');
  });

  it('a reply with the wrong number of strings stores FAILED and no pairs', async () => {
    const saved = await run(stubGenai({ translator: { texts: ['one'], keywords }, translationCheck: { findings: [] } }));
    expect(saved).toMatchObject({ status: 'FAILED', texts: [] });
  });

  it('a blocker finding stores BLOCKED, a review finding NEEDS_REVIEW', async () => {
    const finding = (status: string) => ({ findings: [{ status, findingCode: 'NUMBER_CHANGED', text: texts[0], explanationForTeacher: 'x' }] });
    expect((await run(stubGenai({ translator, translationCheck: finding('BLOCKER') }))).status).toBe('BLOCKED');
    expect((await run(stubGenai({ translator, translationCheck: finding('REVIEW_REQUIRED') }))).status).toBe('NEEDS_REVIEW');
  });

  it('every write raises the version', async () => {
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    const deps = { db: live.db, bucket: live.bucket, genai: stubGenai({ translator, translationCheck: { findings: [] } }), config: testWorkerConfig(), loadFixture };
    await translateTask({ deps, lesson: { id, contentLocale: 'en' } }, q5, 'tdr_1');
    await translateTask({ deps, lesson: { id, contentLocale: 'en' } }, q5, 'tdr_1');
    expect((await live.db.doc(`lessons/${id}/taskTranslations/Q5`).get()).data()?.version).toBe(2);
  });

  it('a late result for a replaced draft is dropped', async () => {
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    await live.db.doc(`lessons/${id}`).set({ schoolId, currentTaskDraftIds: { Q5: 'tdr_2' } });
    const deps = { db: live.db, bucket: live.bucket, genai: stubGenai({ translator, translationCheck: { findings: [] } }), config: testWorkerConfig(), loadFixture };
    await translateTask({ deps, lesson: { id, contentLocale: 'en' } }, q5, 'tdr_1');
    expect((await live.db.doc(`lessons/${id}/taskTranslations/Q5`).get()).exists).toBe(false);
  });

  it('a late result is dropped if a teacher changed the translation meanwhile', async () => {
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    const ref = live.db.doc(`lessons/${id}/taskTranslations/Q5`);
    await ref.set({ slot: 'Q5', draftId: 'tdr_1', version: 1, status: 'WORKING', texts: [{ from: 'x', to: 'lời cô' }], keywords: {}, findings: [] });
    const genai = stubGenai({ translator, translationCheck: () => { void ref.update({ version: 5 }); return { findings: [] }; } });
    const deps = { db: live.db, bucket: live.bucket, genai, config: testWorkerConfig(), loadFixture };
    await translateTask({ deps, lesson: { id, contentLocale: 'en' } }, q5, 'tdr_1');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await ref.get()).data()?.texts).toEqual([{ from: 'x', to: 'lời cô' }]);
  });

  it('findings get a code unique to this version, so an old acceptance cannot clear them', async () => {
    const finding = { status: 'REVIEW_REQUIRED', findingCode: 'SHIFT', text: 'a', explanationForTeacher: 'x' };
    const saved = await run(stubGenai({ translator, translationCheck: { findings: [finding, finding] } }));
    expect(new Set(saved.findings.map((f: { findingCode: string }) => f.findingCode)).size).toBe(2);
    expect(saved.findings[0].findingCode).toContain('v1');
  });

  it('a changed template token is a blocker', async () => {
    const q4 = { ...q5, slot: 'Q4', questionStem: 'Choose [shown] now', challengeCandidates: q5.challengeCandidates, feedback: [], taskBody: {} } as DraftFixture;
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    const genai = stubGenai({ translator: { texts: studentTexts(q4).map((text) => text.replace('[shown]', '[hiện]')), keywords: {} }, translationCheck: { findings: [] } });
    await translateTask({ deps: { db: live.db, bucket: live.bucket, genai, config: testWorkerConfig(), loadFixture }, lesson: { id, contentLocale: 'en' } }, q4, 'tdr_1');
    expect((await live.db.doc(`lessons/${id}/taskTranslations/Q4`).get()).data()?.status).toBe('BLOCKED');
  });

  it('a failed recheck keeps the teacher wording', async () => {
    n += 1;
    const id = `les_${schoolId}_t${n}`;
    lessons.push(id);
    const genai = stubGenai({ translator, translationCheck: () => { throw new Error('down'); } });
    const texts = studentTexts(q5).map((from) => ({ from, to: 'lời cô' }));
    await translateTask({ deps: { db: live.db, bucket: live.bucket, genai, config: testWorkerConfig(), loadFixture }, lesson: { id, contentLocale: 'en' } }, q5, 'tdr_1', { texts, keywords });
    expect((await live.db.doc(`lessons/${id}/taskTranslations/Q5`).get()).data()).toMatchObject({ status: 'FAILED', texts, keywords });
  });

  it('a blank translated keyword is refused, because it would match every answer', async () => {
    const saved = await run(stubGenai({ translator: { texts: translator.texts, keywords: { training: [''] } }, translationCheck: { findings: [] } }));
    expect(saved.status).toBe('FAILED');
  });

  it('a failed check stores FAILED, so an unchecked translation cannot be approved', async () => {
    const saved = await run(stubGenai({ translator, translationCheck: () => { throw new Error('down'); } }));
    expect(saved).toMatchObject({ status: 'FAILED', texts: [] });
  });
});

describe('TRANSLATE jobs', () => {
  const q1 = loadFixture('q1-v4', 'en') as DraftFixture;
  const bundle = loadFixture('rule-bundles/q1', 'en');
  const pass = ['QG1', 'QG2', 'QG3', 'QG4', 'QG5', 'QG6'].map((gateId) => ({ gateId, status: 'PASS', findingCodes: [], sourceRefs: [], affectedArtifactIds: [], explanationForTeacher: 'x', overridable: false }));
  const translated = () => ({ texts: studentTexts(q1).map((text) => `vi ${text}`), keywords: {} });

  const drafted = async () => {
    const context = await setup({ stage: 'GENERATE_PREVIEW' });
    await live.db.doc(`lessons/${context.lessonId}/sourceUnits/p1-1`).set({ text: q1.answerOptions!.map((a) => a.text).join(' ') + q1.generatedE!.map((e) => e.text).join(' ') });
    await live.db.doc(`jobs/${context.jobId}`).update({ type: 'GENERATE', targetIds: ['Q1'] });
    await worker(stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: pass }, translator: translated(), translationCheck: { findings: [] } })).runJob(context.jobId);
    const translateId = `${context.jobId}_t`;
    jobs.push(translateId);
    return { ...context, translateId };
  };

  it('a job that dies while translating leaves FAILED, not WORKING', async () => {
    const { lessonId, translateId } = await drafted();
    const ref = live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`);
    await ref.update({ status: 'WORKING' });
    await live.db.doc(`jobs/${translateId}`).set({ schoolId, lessonId, type: 'TRANSLATE', status: 'QUEUED', steps: [], targetIds: ['Q1'] });
    await worker(stubGenai(), { config: testWorkerConfig({ deadlineMs: -1 }) }).runJob(translateId);
    expect((await ref.get()).data()?.status).toBe('FAILED');
  });

  it('a seeded lesson never runs a translation job', async () => {
    const { lessonId, translateId } = await drafted();
    await live.db.doc(`lessons/${lessonId}`).update({ aiMode: 'SEEDED' });
    await live.db.doc(`jobs/${translateId}`).set({ schoolId, lessonId, type: 'TRANSLATE', status: 'QUEUED', steps: [], targetIds: ['Q1'] });
    const genai = stubGenai();
    await worker(genai).runJob(translateId);
    expect(genai.calls).toEqual([]);
  });

  it('a retry translates the task again', async () => {
    const { lessonId, translateId } = await drafted();
    await live.db.doc(`jobs/${translateId}`).set({ schoolId, lessonId, type: 'TRANSLATE', status: 'QUEUED', steps: [], targetIds: ['Q1'] });
    const genai = stubGenai({ translator: translated(), translationCheck: { findings: [] } });
    await worker(genai).runJob(translateId);
    expect(genai.calls.map((c) => c.role)).toEqual(['translationCheck']);
  });

  it('a retry on a blocked translation starts over', async () => {
    const { lessonId, translateId } = await drafted();
    await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).update({ status: 'WORKING' });
    await live.db.doc(`jobs/${translateId}`).set({ schoolId, lessonId, type: 'TRANSLATE', status: 'QUEUED', steps: [], targetIds: ['Q1'], fresh: true });
    const genai = stubGenai({ translator: translated(), translationCheck: { findings: [] } });
    await worker(genai).runJob(translateId);
    expect(genai.calls.map((c) => c.role)).toEqual(['translator', 'translationCheck']);
  });

  it('a recheck keeps the teacher wording and calls only the check', async () => {
    const { lessonId, translateId } = await drafted();
    const ref = live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`);
    const texts = (await ref.get()).data()!.texts as { from: string; to: string }[];
    await ref.update({ texts: texts.map((pair, index) => (index === 0 ? { ...pair, to: 'Lời của cô' } : pair)), status: 'WORKING' });
    await live.db.doc(`jobs/${translateId}`).set({ schoolId, lessonId, type: 'TRANSLATE', status: 'QUEUED', steps: [], targetIds: ['Q1'], recheck: true });
    const genai = stubGenai({ translationCheck: { findings: [] } });
    await worker(genai).runJob(translateId);
    expect(genai.calls.map((c) => c.role)).toEqual(['translationCheck']);
    expect((await ref.get()).data()).toMatchObject({ status: 'READY' });
    expect((await ref.get()).data()!.texts[0].to).toBe('Lời của cô');
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
    expect(genai.calls.map((c) => c.role).slice(0, 2)).toEqual(['generator', 'xreason']);
    expect(textOf(roleCalls(genai, 'xreason')[0]!)).not.toContain('supportExtentRationaleX');
  });

  it('LIVE GENERATE fills the evidence column from QG2', async () => {
    const reviewed = gates('PASS').map((gate) => (gate.gateId === 'QG2' ? { ...gate, status: 'BLOCKER', overridable: false, sourceRefs: ['p1-1', 'p2-3'], explanationForTeacher: 'The source does not refute A2.' } : gate));
    const { lessonId, jobId } = await setupGenerate();
    await worker(stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: reviewed } })).runJob(jobId);
    expect((await live.db.doc(`lessons/${lessonId}/taskSufficiency/Q1`).get()).data()).toMatchObject({ slot: 'Q1', assessment: 'INSUFFICIENT', sourceRefs: 'p1-1 · p2-3', explanationForTeacher: 'The source does not refute A2.' });
  });

  it('a task the AI cannot draft does not stop the next one', async () => {
    const inner = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') } });
    const genai: StubGenai = {
      ...inner,
      generate: async (request) => {
        if (request.role === 'generator' && JSON.stringify(request.parts).includes('Task slot: Q1')) throw new Error('down');
        return inner.generate(request);
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { lessonId, jobId } = await setupGenerate();
    await live.db.doc(`jobs/${jobId}`).update({ targetIds: ['Q1', 'Q2'] });
    await worker(genai).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'FAILED', error: { code: 'AI_FAILED' } });
    expect(Object.keys((await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds)).toEqual(['Q2']);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: 'AI_ATTEMPT_FAILED', role: 'generator', attempt: 2, failure: 'CALL_FAILED' }));
    warn.mockRestore();
  });

  const translated = () => ({ texts: studentTexts(q1).map((text) => `vi ${text}`), keywords: {} });

  it('LIVE GENERATE translates each task it drafts', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') }, translator: translated(), translationCheck: { findings: [] } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    expect((await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).get()).data()).toMatchObject({ status: 'READY', locale: 'vi' });
    expect(await job(jobId)).toMatchObject({ status: 'DONE' });
  });

  it('a failed translation leaves the draft and the job done, ready to retry', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') }, translator: () => { throw new Error('down'); } });
    const { lessonId, jobId } = await setupGenerate();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await worker(genai).runJob(jobId);
    warn.mockRestore();
    expect((await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).get()).data()).toMatchObject({ status: 'FAILED' });
    expect((await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1).toBeDefined();
    expect(await job(jobId)).toMatchObject({ status: 'DONE' });
  });

  it('the translation is marked as working before the draft can be approved', async () => {
    const statuses: unknown[] = [];
    const { lessonId, jobId } = await setupGenerate();
    const inner = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') }, translator: translated(), translationCheck: { findings: [] } });
    const genai: StubGenai = {
      ...inner,
      generate: async (request) => {
        if (request.role === 'xreason') statuses.push((await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).get()).data()?.status);
        return inner.generate(request);
      },
    };
    await worker(genai).runJob(jobId);
    expect(statuses).toEqual(['WORKING']);
  });

  it('a job over its limit stops between AI calls', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') } });
    const { lessonId, jobId } = await setupGenerate();
    let checks = 0;
    await worker(genai, { beforeStep: async () => { checks += 1; if (checks > 1) await new Promise((resolve) => setTimeout(resolve, 30)); } , config: testWorkerConfig({ deadlineMs: 0 }) }).runJob(jobId);
    expect(await job(jobId)).toMatchObject({ status: 'TIMED_OUT' });
    expect(roleCalls(genai, 'xreason')).toHaveLength(0);
    expect((await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).get()).data()?.status ?? 'FAILED').toBe('FAILED');
  });

  it('a cancelled job stays cancelled', async () => {
    const genai = stubGenai({ generator: () => { void live.db.doc(`jobs/${cancelledJob}`).update({ status: 'CANCELLED' }); return { draft: q1, ruleBundle: bundle }; }, xreason: { gates: gates('PASS') } });
    const { jobId } = await setupGenerate();
    cancelledJob = jobId;
    await worker(genai).runJob(jobId);
    expect((await job(jobId)).status).toBe('CANCELLED');
  });

  it('a hung AI call counts as failed', async () => {
    const genai: StubGenai = { calls: [], generate: () => new Promise(() => {}) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(generateStructured(genai, testWorkerConfig({ aiCallTimeoutMs: 5 }), { role: 'xreason', schema: z.object({}) })).rejects.toThrow('AI_FAILED');
    warn.mockRestore();
  });

  it('tasks are drafted at the same time, not one after another', async () => {
    let started = 0;
    let release!: () => void;
    const both = new Promise<void>((resolve) => { release = resolve; });
    const inner = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') }, translator: translated(), translationCheck: { findings: [] } });
    const genai: StubGenai = {
      ...inner,
      generate: async (request) => {
        if (request.role === 'generator') {
          started += 1;
          if (started === 2) release();
          await both;
        }
        return inner.generate(request);
      },
    };
    const { jobId } = await setupGenerate();
    await live.db.doc(`jobs/${jobId}`).update({ targetIds: ['Q1', 'Q2'] });
    await worker(genai).runJob(jobId);
    expect(started).toBe(2);
  }, 20_000);

  it('an edit retranslates only new wording and keeps the other pairs', async () => {
    const genai = stubGenai({ generator: { draft: q1, ruleBundle: bundle }, xreason: { gates: gates('PASS') }, translator: translated(), translationCheck: { findings: [] } });
    const { lessonId, jobId } = await setupGenerate();
    await worker(genai).runJob(jobId);
    const draftId = (await live.db.doc(`lessons/${lessonId}`).get()).data()?.currentTaskDraftIds.Q1 as string;
    const ref = live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`);
    await ref.update({ questionStem: 'A rewritten question' });
    const rerunId = `${jobId}_e`;
    jobs.push(rerunId);
    await live.db.doc(`jobs/${rerunId}`).set({ schoolId, lessonId, type: 'RERUN', status: 'QUEUED', steps: [], targetIds: [draftId] });
    const again = stubGenai({ xreason: { gates: gates('PASS') }, translator: { texts: ['vi rewritten'], keywords: {} }, translationCheck: { findings: [] } });
    await worker(again).runJob(rerunId);
    expect(textOf(roleCalls(again, 'translator')[0]!)).toContain('{"texts":["A rewritten question"]');
    const saved = (await live.db.doc(`lessons/${lessonId}/taskTranslations/Q1`).get()).data()!;
    expect(saved.texts).toContainEqual({ from: 'A rewritten question', to: 'vi rewritten' });
    expect(saved.texts).toContainEqual({ from: q1.answerOptions![0]!.text, to: `vi ${q1.answerOptions![0]!.text}` });
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
