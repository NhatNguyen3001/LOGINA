import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { loadFixture, type DraftFixture, type FixtureName } from '@logina/domain';
import { liveSetup, testSchoolId, type LiveProject } from '@logina/test-utils';
import { createWorker, type WorkerDeps } from '../src/worker.js';
import { testWorkerConfig } from '../src/config.js';
import { resolveAiMode } from '../src/ai/mode.js';
import { stubGenai } from './fakes/genai.js';

let live: LiveProject;
const schoolId = testSchoolId();
const lessons: string[] = [];
const jobs: string[] = [];

let n = 0;
const newId = (prefix: string) => {
  n += 1;
  return `${prefix}_${schoolId}_${n}`;
};

async function seedLesson(fields: object = {}): Promise<string> {
  const id = newId('les');
  lessons.push(id);
  await live.db.doc(`lessons/${id}`).set({
    schoolId,
    aiMode: 'SEEDED',
    contentLocale: 'en',
    stage: 'CLARIFY',
    version: 1,
    currentIntentVersionId: 'int_1',
    currentSourceModelVersionId: 'smv_1',
    currentMaterialVersionId: 'mat_1',
    currentTaskDraftIds: {},
    ...fields,
  });
  await live.db.doc(`lessons/${id}/materialVersions/mat_1`).set({ parseStatus: 'PENDING', mimeType: 'application/pdf', storagePath: 'demo/material.en.pdf' });
  return id;
}

async function seedJob(lessonId: string, type: string, fields: object = {}): Promise<string> {
  const id = newId('job');
  jobs.push(id);
  await live.db.doc(`jobs/${id}`).set({ schoolId, lessonId, type, status: 'QUEUED', steps: [], targetIds: [], attempt: 0, ...fields });
  await live.db.doc(`lessons/${lessonId}`).update({ activeJobId: id });
  return id;
}

const worker = (overrides: Partial<WorkerDeps> = {}) =>
  createWorker({ db: live.db, bucket: live.bucket, genai: stubGenai(), config: testWorkerConfig(), loadFixture, ...overrides });

const job = async (id: string) => (await live.db.doc(`jobs/${id}`).get()).data()!;
const lesson = async (id: string) => (await live.db.doc(`lessons/${id}`).get()).data()!;
const collection = async (path: string) => (await live.db.collection(path).get()).docs;

const generated = async (lessonId: string, targetIds: string[] = []) => {
  const id = await seedJob(lessonId, 'GENERATE', { targetIds });
  await worker().runJob(id);
  return lesson(lessonId);
};

beforeAll(async () => {
  live = await liveSetup();
});

afterAll(async () => {
  await Promise.all(lessons.map((id) => live.db.recursiveDelete(live.db.doc(`lessons/${id}`))));
  await Promise.all(jobs.map((id) => live.db.doc(`jobs/${id}`).delete()));
  await live.db.doc(`schools/${schoolId}`).delete();
});

describe('seeded PARSE', () => {
  it('writes units, evidence, claims and issues, then moves to CLARIFY', async () => {
    const lessonId = await seedLesson();
    const id = await seedJob(lessonId, 'PARSE');
    await worker().runJob(id);
    const units = await collection(`lessons/${lessonId}/sourceUnits`);
    expect(units.length).toBeGreaterThan(0);
    expect(units.every((u) => u.data().readBy === 'SEEDED')).toBe(true);
    expect((await collection(`lessons/${lessonId}/clarificationIssues`)).length).toBe(4);
    expect((await collection(`lessons/${lessonId}/sourceClaims`)).length).toBe(5);
    expect(await job(id)).toMatchObject({ status: 'DONE' });
    expect(await lesson(lessonId)).toMatchObject({ stage: 'CLARIFY' });
  });

  it('terminal job status clears lesson activeJobId', async () => {
    const lessonId = await seedLesson();
    await worker().runJob(await seedJob(lessonId, 'PARSE'));
    expect((await lesson(lessonId)).activeJobId).toBeUndefined();
  });

  it('seeded output follows lesson.contentLocale', async () => {
    const lessonId = await seedLesson({ contentLocale: 'vi' });
    await worker().runJob(await seedJob(lessonId, 'PARSE'));
    const issue = (await collection(`lessons/${lessonId}/clarificationIssues`))[0]?.data();
    expect(issue?.bubble).toMatch(/[ăâđêôơư]/);
  });

  it('retried job does not duplicate units', async () => {
    const lessonId = await seedLesson();
    const id = await seedJob(lessonId, 'PARSE');
    await worker().runJob(id);
    const before = (await collection(`lessons/${lessonId}/sourceUnits`)).length;
    await live.db.doc(`jobs/${id}`).update({ status: 'QUEUED' });
    await worker().runJob(id);
    expect((await collection(`lessons/${lessonId}/sourceUnits`)).length).toBe(before);
  });

  it('a job already DONE is not run again', async () => {
    const lessonId = await seedLesson();
    const id = await seedJob(lessonId, 'PARSE', { status: 'DONE' });
    await worker().runJob(id);
    expect((await collection(`lessons/${lessonId}/sourceUnits`)).length).toBe(0);
  });

  it('cancelled job stops at the next step and writes nothing more', async () => {
    const lessonId = await seedLesson();
    const id = await seedJob(lessonId, 'PARSE');
    await worker({ beforeStep: () => live.db.doc(`jobs/${id}`).update({ status: 'CANCELLED' }) }).runJob(id);
    expect((await collection(`lessons/${lessonId}/clarificationIssues`)).length).toBe(0);
    expect(await job(id)).toMatchObject({ status: 'CANCELLED' });
  });
});

describe('seeded GENERATE and VALIDATE', () => {
  it('drafts Q1, Q2, Q3 and Q5, and leaves Q4 paused', async () => {
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    const after = await generated(lessonId);
    expect(Object.keys(after.currentTaskDraftIds).sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q5']);
    const sufficiency = await collection(`lessons/${lessonId}/taskSufficiency`);
    expect(sufficiency.find((d) => d.data().slot === 'Q4')?.data().assessment).toBe('UNCERTAIN');
  });

  it('VALIDATE writes report with validatorVersion and sets the draft status', async () => {
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    const after = await generated(lessonId);
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${after.currentTaskDraftIds.Q1}`).get()).data()!;
    expect(draft.status).toBe('REVIEW_REQUIRED');
    const report = (await live.db.doc(`lessons/${lessonId}/validationReports/${draft.latestValidationReportId}`).get()).data()!;
    expect(report.gates[0].validatorVersion).toContain('+seeded');
    expect(report.previewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(report.contentManifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('regenerating Q4 writes only Q4, blocked by QG5', async () => {
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    await generated(lessonId);
    const after = await generated(lessonId, ['Q4']);
    const q4 = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${after.currentTaskDraftIds.Q4}`).get()).data()!;
    expect(q4).toMatchObject({ draftVersion: 3, status: 'BLOCKED' });
  });

  it('retried job does not duplicate drafts', async () => {
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    const id = await seedJob(lessonId, 'GENERATE');
    await worker().runJob(id);
    const before = (await collection(`lessons/${lessonId}/taskDrafts`)).length;
    await live.db.doc(`jobs/${id}`).update({ status: 'QUEUED' });
    await worker().runJob(id);
    expect((await collection(`lessons/${lessonId}/taskDrafts`)).length).toBe(before);
  });

  it('deterministic checks run even in seeded mode', async () => {
    const corrupted = (name: FixtureName, locale: 'en' | 'vi') => {
      const fixture = loadFixture(name, locale);
      if (name !== 'q1-v3') return fixture;
      const draft = structuredClone(fixture) as DraftFixture;
      draft.generatedE = draft.generatedE!.slice(0, 3);
      return draft;
    };
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    await worker({ loadFixture: corrupted }).runJob(await seedJob(lessonId, 'GENERATE'));
    const after = await lesson(lessonId);
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${after.currentTaskDraftIds.Q1}`).get()).data()!;
    expect(draft.status).toBe('BLOCKED');
  });
});

describe('seeded RERUN', () => {
  const editedDraft = async (fields: { text: string }) => {
    const lessonId = await seedLesson({ stage: 'GENERATE_PREVIEW' });
    const after = await generated(lessonId);
    const draftId = after.currentTaskDraftIds.Q1 as string;
    return { lessonId, draftId, edit: { editScope: 'CONTENT', payload: { optionId: 'A4', text: fields.text } } };
  };
  const a4v4 = (loadFixture('scripted-edits', 'en') as { id: string; payload: { text: string } }[]).find((e) => e.id === 'q1-a4-reword')!;

  it('a scripted edit gives the seeded v4 result', async () => {
    const { lessonId, draftId, edit } = await editedDraft({ text: a4v4.payload.text });
    await worker().runJob(await seedJob(lessonId, 'RERUN', { targetIds: [draftId], edit }));
    const after = await lesson(lessonId);
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${after.currentTaskDraftIds.Q1}`).get()).data()!;
    expect(draft).toMatchObject({ draftVersion: 4, status: 'REVIEW_REQUIRED' });
    const report = (await live.db.doc(`lessons/${lessonId}/validationReports/${draft.latestValidationReportId}`).get()).data()!;
    expect(report.gates.filter((g: { status: string }) => g.status !== 'PASS').map((g: { gateId: string }) => g.gateId)).toEqual(['QG1']);
  });

  it('unscripted edit without live AI yields REVIEW_REQUIRED', async () => {
    const { lessonId, draftId, edit } = await editedDraft({ text: 'Something the script does not know.' });
    await worker().runJob(await seedJob(lessonId, 'RERUN', { targetIds: [draftId], edit }));
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()!;
    expect(draft.status).toBe('REVIEW_REQUIRED');
  });

  it('R07 failed rerun never restores previous PASS', async () => {
    const { lessonId, draftId, edit } = await editedDraft({ text: a4v4.payload.text });
    await live.db.doc(`schools/${schoolId}`).set({ failNextRerun: true }, { merge: true });
    const before = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()!;
    const id = await seedJob(lessonId, 'RERUN', { targetIds: [draftId], edit });
    await worker().runJob(id);
    const draft = (await live.db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`).get()).data()!;
    expect(draft.status).toBe('FAILED');
    expect(draft.latestValidationReportId).toBe(before.latestValidationReportId);
    expect(await job(id)).toMatchObject({ status: 'TIMED_OUT', error: { code: 'TIMED_OUT' } });
  });

  it('failNextRerun is one-shot', async () => {
    await live.db.doc(`schools/${schoolId}`).set({ failNextRerun: FieldValue.delete() }, { merge: true });
    const { lessonId, draftId, edit } = await editedDraft({ text: 'Another edit.' });
    await live.db.doc(`schools/${schoolId}`).set({ failNextRerun: true }, { merge: true });
    await worker().runJob(await seedJob(lessonId, 'RERUN', { targetIds: [draftId], edit }));
    expect((await live.db.doc(`schools/${schoolId}`).get()).data()?.failNextRerun).toBeFalsy();
  });
});

describe('resolveAiMode', () => {
  it('lessons.aiMode decides', () => {
    expect(resolveAiMode({ aiMode: 'LIVE' }, { seededAi: false })).toBe('LIVE');
    expect(resolveAiMode({ aiMode: 'SEEDED' }, { seededAi: false })).toBe('SEEDED');
  });

  it('SEEDED_AI=true override makes a LIVE lesson LIVE_DISABLED', () => {
    expect(resolveAiMode({ aiMode: 'LIVE' }, { seededAi: true })).toBe('LIVE_DISABLED');
    expect(resolveAiMode({ aiMode: 'SEEDED' }, { seededAi: true })).toBe('SEEDED');
  });
});
