import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttemptDTO, StudentChallengeDTO, StudentFeedbackDTO, StudentTaskDTO, SubmitResultDTO, findRestrictedKeys } from '@logina/contracts';
import { loadFixture, type DraftFixture } from '@logina/domain';
import { harness, seedAssigned, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let assignmentId: string;
let n = 0;

/** A fresh attempt each time: the same assignment, a new student key is not available, so a new revision. */
async function freshAttempt(): Promise<string> {
  n += 1;
  const copy = `${assignmentId}_c${n}`;
  const source = (await h.live.db.doc(`assignments/${assignmentId}`).get()).data()!;
  await h.live.db.doc(`assignments/${copy}`).set(source);
  const attempt = AttemptDTO.parse(await (await a.post(`/assignments/${copy}/attempts`)).json());
  return attempt.attemptId;
}

const task = async (attemptId: string, slot = 'Q1') => StudentTaskDTO.parse(await (await a.get(`/attempts/${attemptId}/tasks/${slot}`)).json());
const q1Options = async (attemptId: string) => {
  const t = (await task(attemptId)) as Extract<StudentTaskDTO, { slot: 'Q1' }>;
  return { answers: t.answers.map((x) => x.id), evidence: t.evidence.map((x) => x.id) };
};
const q1 = (answerId: string, evidenceId: string) => ({ slot: 'Q1', answerId, evidenceId });
const lock = (attemptId: string, artifact: object, slot = 'Q1', key?: string) =>
  a.post(`/attempts/${attemptId}/tasks/${slot}/lock`, { artifact, initialConfidence: 70 }, key);
const submit = (attemptId: string, choice: string, finalArtifact: object, slot = 'Q1') =>
  a.post(`/attempts/${attemptId}/tasks/${slot}/submit`, { choice, finalArtifact, finalConfidence: 82 });

const inVietnamese = async <T>(work: () => Promise<T>): Promise<T> => {
  await a.patch('/me', { uiLocale: 'vi' });
  try {
    return await work();
  } finally {
    await a.patch('/me', { uiLocale: 'en' });
  }
};

const artifacts: Record<string, object> = {
  Q2: { slot: 'Q2', orderedCardIds: ['K1', 'K2', 'K3', 'K4'] },
  Q3: { slot: 'Q3', comparisons: [{ criterionId: 'C1', value: 'O1' }], judgmentOptionId: 'O1', tradeOffIds: ['D1'] },
  Q4: { slot: 'Q4', templateId: 'M1', slots: [{ slotId: 'shown', choiceId: 'S1' }, { slotId: 'missing', choiceId: 'M1' }] },
  Q5: { slot: 'Q5', proposal: 'Open trade courses', reason: 'Many jobs need training' },
};

beforeAll(async () => {
  h = await harness({}, {}, { runJobs: ['GENERATE', 'RERUN'] });
  a = await h.client();
  ({ assignmentId } = await seedAssigned(h, a));
}, 240_000);

afterAll(async () => {
  const copies = await h.live.db.collection('assignments').where('schoolId', '==', a.workspace.schoolId).get();
  await Promise.all(copies.docs.map((doc) => doc.ref.delete()));
  await h.close();
});

describe('switching language on the sample lesson', () => {
  const stem = (loadFixture('q1-v4', 'vi') as DraftFixture).questionStem;

  it('questions, options and cards change, and every ID and the order stay the same', async () => {
    const attemptId = await freshAttempt();
    const before = (await task(attemptId)) as Extract<StudentTaskDTO, { slot: 'Q1' }>;
    const after = (await inVietnamese(() => task(attemptId))) as Extract<StudentTaskDTO, { slot: 'Q1' }>;
    expect(after.stem).toBe(stem);
    expect(after.answers.map((x) => x.id)).toEqual(before.answers.map((x) => x.id));
    expect(after.evidence.map((x) => x.id)).toEqual(before.evidence.map((x) => x.id));
    expect(after.answers[0]?.text).not.toBe(before.answers[0]?.text);
  });

  it('the locked answer and its prompt follow the language too', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    await lock(attemptId, q1(answers[0]!, evidence[0]!));
    const en = StudentChallengeDTO.parse(await (await a.get(`/attempts/${attemptId}/tasks/Q1/challenge`)).json());
    const vi = StudentChallengeDTO.parse(await inVietnamese(async () => (await a.get(`/attempts/${attemptId}/tasks/Q1/challenge`)).json()));
    expect(vi.deliveryId).toBe(en.deliveryId);
    expect(vi.message).not.toBe(en.message);
    expect(vi.lockedSummary.answerText).not.toBe(en.lockedSummary.answerText);
  });

  it('wording a teacher changed stays as written', async () => {
    const attemptId = await freshAttempt();
    const { releaseIds, lessonId } = (await h.live.db.doc(`attempts/${attemptId}`).get()).data()!;
    const ref = h.live.db.doc(`lessons/${lessonId}/taskReleases/${releaseIds.Q1}`);
    const release = (await ref.get()).data()!;
    await ref.update({ 'publicContent.questionStem': 'A question the teacher rewrote' });
    const after = await inVietnamese(() => task(attemptId));
    await ref.update({ 'publicContent.questionStem': release.publicContent.questionStem });
    expect(after.stem).toBe('A question the teacher rewrote');
  });

  it('the assignment list shows the title in the chosen language', async () => {
    const lesson = h.live.db.doc(`lessons/${(await h.live.db.doc(`assignments/${assignmentId}`).get()).data()!.lessonId}`);
    const { title } = (await lesson.get()).data()!;
    await lesson.update({ title: 'Lesson 8: Labor and employment' });
    const { assignments } = await inVietnamese(async () => (await (await a.get('/me/assignments')).json()) as { assignments: { lessonTitle: string }[] });
    await lesson.update({ title });
    expect(assignments.map((x) => x.lessonTitle)).toContain('Bài 8: Lao động và việc làm');
  });
});

describe('attempts', () => {
  it('start attempt returns AttemptDTO with five slots', async () => {
    const attempt = AttemptDTO.parse(await (await a.post(`/assignments/${assignmentId}/attempts`)).json());
    expect(attempt.slots.map((s) => s.slot)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(attempt.slots.every((s) => s.phase === 'REASON')).toBe(true);
  });

  it('start attempt twice returns the same attemptId', async () => {
    const first = AttemptDTO.parse(await (await a.post(`/assignments/${assignmentId}/attempts`)).json());
    const second = AttemptDTO.parse(await (await a.post(`/assignments/${assignmentId}/attempts`)).json());
    expect(second.attemptId).toBe(first.attemptId);
  });

  it('another session cannot open this attempt', async () => {
    const attemptId = await freshAttempt();
    const b = await h.client();
    expect((await b.get(`/attempts/${attemptId}/tasks/Q1`)).status).toBe(404);
  });
});

describe('Q1 lock and challenge', () => {
  it('SEC01 task DTO before lock has no labels and passes the student scan', async () => {
    const attemptId = await freshAttempt();
    const raw = await (await a.get(`/attempts/${attemptId}/tasks/Q1`)).json();
    expect(findRestrictedKeys(raw, 'student')).toEqual([]);
    const parsed = StudentTaskDTO.parse(raw);
    expect(parsed).not.toHaveProperty('initialArtifact');
    expect(JSON.stringify(raw)).not.toMatch(/"A[1-4]"|"E[1-4]"/);
  });

  it('Q05 evidence_id maps to generatedEId via release, source evidence ids rejected', async () => {
    const attemptId = await freshAttempt();
    const { answers } = await q1Options(attemptId);
    expect((await lock(attemptId, q1(answers[0]!, 'se1'))).status).toBe(400);
  });

  it('Q01 lock stores exactly one answer and one evidence, SEC02 one message', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    const raw = await (await lock(attemptId, q1(answers[1]!, evidence[2]!))).json();
    const challenge = StudentChallengeDTO.parse(raw);
    expect(challenge.message).toContain('Compare the statement');
    expect(challenge.lockedSummary.confidence).toBe(70);
    expect(findRestrictedKeys(raw, 'student')).toEqual([]);
  });

  it('lock is idempotent and creates one delivery', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    const first = StudentChallengeDTO.parse(await (await lock(attemptId, q1(answers[0]!, evidence[1]!))).json());
    const second = StudentChallengeDTO.parse(await (await lock(attemptId, q1(answers[0]!, evidence[1]!))).json());
    expect(second.deliveryId).toBe(first.deliveryId);
    expect((await h.live.db.collection(`attempts/${attemptId}/tasks/Q1/deliveries`).get()).size).toBe(1);
  });

  it('S04 reload after lock returns the same delivery', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    const locked = StudentChallengeDTO.parse(await (await lock(attemptId, q1(answers[0]!, evidence[1]!))).json());
    const again = StudentChallengeDTO.parse(await (await a.get(`/attempts/${attemptId}/tasks/Q1/challenge`)).json());
    expect(again).toEqual(locked);
  });

  it('task DTO after lock carries initialArtifact with runtime IDs and initialConfidence', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    await lock(attemptId, q1(answers[0]!, evidence[0]!));
    const raw = await (await a.get(`/attempts/${attemptId}/tasks/Q1`)).json();
    expect(StudentTaskDTO.parse(raw)).toMatchObject({ initialArtifact: { answerId: answers[0] }, initialConfidence: 70, phase: 'CHALLENGED' });
    expect(findRestrictedKeys(raw, 'student')).toEqual([]);
  });

  it('locked artifact cannot be changed by a later draft PUT', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    await lock(attemptId, q1(answers[0]!, evidence[0]!));
    const response = await a.put(`/attempts/${attemptId}/tasks/Q1/draft`, { draftArtifact: { slot: 'Q1', answerId: answers[1] } });
    expect(response.status).toBe(409);
  });

  it('draft autosaves before lock', async () => {
    const attemptId = await freshAttempt();
    const { answers } = await q1Options(attemptId);
    expect((await a.put(`/attempts/${attemptId}/tasks/Q1/draft`, { draftArtifact: { slot: 'Q1', answerId: answers[1] } })).status).toBe(200);
    expect((await task(attemptId)).draftArtifact).toMatchObject({ answerId: answers[1] });
  });
});

describe('submit', () => {
  const lockedQ1 = async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    await lock(attemptId, q1(answers[1]!, evidence[2]!));
    return { attemptId, answers, evidence };
  };

  it('submit returns SubmitResultDTO with recordedChoice and nextSlot', async () => {
    const { attemptId, answers, evidence } = await lockedQ1();
    const result = SubmitResultDTO.parse(await (await submit(attemptId, 'REVISE', q1(answers[0]!, evidence[0]!))).json());
    expect(result).toMatchObject({ recordedChoice: 'REVISE', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
  });

  it('S01 revise answer and evidence is one REVISE, no second challenge', async () => {
    const { attemptId, answers, evidence } = await lockedQ1();
    await submit(attemptId, 'REVISE', q1(answers[0]!, evidence[0]!));
    const stored = (await h.live.db.doc(`attempts/${attemptId}/tasks/Q1`).get()).data();
    expect(stored).toMatchObject({ choice: 'REVISE', changedElements: ['answer', 'evidence'], phase: 'SUBMITTED' });
    expect((await h.live.db.collection(`attempts/${attemptId}/tasks/Q1/deliveries`).get()).size).toBe(1);
  });

  it('S6 revise with no change is stored as KEEP, S02 with delta stored', async () => {
    const { attemptId, answers, evidence } = await lockedQ1();
    const result = SubmitResultDTO.parse(await (await submit(attemptId, 'REVISE', q1(answers[1]!, evidence[2]!))).json());
    expect(result.recordedChoice).toBe('KEEP');
    expect((await h.live.db.doc(`attempts/${attemptId}/tasks/Q1`).get()).data()?.confidenceDelta).toBe(12);
  });

  it('a task submits once', async () => {
    const { attemptId, answers, evidence } = await lockedQ1();
    await submit(attemptId, 'KEEP', q1(answers[1]!, evidence[2]!));
    expect((await submit(attemptId, 'KEEP', q1(answers[1]!, evidence[2]!))).status).toBe(409);
  });

  it('confidence must be an integer between 0 and 100', async () => {
    const attemptId = await freshAttempt();
    const { answers, evidence } = await q1Options(attemptId);
    const body = { artifact: q1(answers[0]!, evidence[0]!), initialConfidence: 72.5 };
    expect((await a.post(`/attempts/${attemptId}/tasks/Q1/lock`, body)).status).toBe(400);
  });

  it('D01 feedback unavailable at 4/5, available at 5/5, SEC03 passes the student scan', async () => {
    const { attemptId, answers, evidence } = await lockedQ1();
    await submit(attemptId, 'REVISE', q1(answers[0]!, evidence[0]!));
    for (const slot of ['Q2', 'Q3', 'Q4']) {
      await lock(attemptId, artifacts[slot]!, slot);
      await submit(attemptId, 'KEEP', artifacts[slot]!, slot);
    }
    expect((await a.get(`/attempts/${attemptId}/feedback`)).status).toBe(409);
    await lock(attemptId, artifacts.Q5!, 'Q5');
    const last = SubmitResultDTO.parse(await (await submit(attemptId, 'KEEP', artifacts.Q5!, 'Q5')).json());
    expect(last.attemptStatus).toBe('COMPLETE');
    const raw = await (await a.get(`/attempts/${attemptId}/feedback`)).json();
    const feedback = (raw as unknown[]).map((row) => StudentFeedbackDTO.parse(row));
    expect(feedback).toHaveLength(5);
    expect(feedback[0]).toMatchObject({ initial: { label: 'B · Card C' }, final: { label: 'A · Card A' }, confidenceBefore: 70, confidenceAfter: 82 });
    expect(findRestrictedKeys(raw, 'student')).toEqual([]);
  });
});

describe('prompts for Q2 to Q5', () => {
  it.each(['Q2', 'Q3', 'Q4', 'Q5'])('%s lock delivers one prompt', async (slot) => {
    const attemptId = await freshAttempt();
    const raw = await (await lock(attemptId, artifacts[slot]!, slot, randomUUID())).json();
    expect(StudentChallengeDTO.parse(raw).message.length).toBeGreaterThan(5);
  });
});
