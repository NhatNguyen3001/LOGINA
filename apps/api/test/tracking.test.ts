import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttemptDTO, ClassTrackingDTO, ConsentResultDTO, MeDTO, StudentTaskDTO, TraceDTO, findRestrictedKeys } from '@logina/contracts';
import { harness, seedAssigned, type Client, type Harness } from './helpers.js';

let h: Harness;
let a: Client;
let assignmentId: string;
let attemptId: string;
let copyAttemptId: string;
let copyId: string;

const artifacts: [string, object][] = [
  ['Q2', { slot: 'Q2', orderedCardIds: ['K1', 'K2', 'K3', 'K4'] }],
  ['Q3', { slot: 'Q3', comparisons: [{ criterionId: 'C1', value: 'O1' }], judgmentOptionId: 'O1', tradeOffIds: ['D1'] }],
  ['Q4', { slot: 'Q4', templateId: 'M1', slots: [{ slotId: 'shown', choiceId: 'S1' }, { slotId: 'missing', choiceId: 'M1' }] }],
  ['Q5', { slot: 'Q5', proposal: 'Open trade courses', reason: 'Many jobs need training' }],
];

async function answerQ1(client: Client, attempt: string, answerIndex: number, cardIndex: number, finalAnswer: number, finalCard: number) {
  const task = StudentTaskDTO.parse(await (await client.get(`/attempts/${attempt}/tasks/Q1`)).json()) as Extract<StudentTaskDTO, { slot: 'Q1' }>;
  const artifact = (i: number, j: number) => ({ slot: 'Q1', answerId: task.answers[i]!.id, evidenceId: task.evidence[j]!.id });
  await client.post(`/attempts/${attempt}/tasks/Q1/lock`, { artifact: artifact(answerIndex, cardIndex), initialConfidence: 70 });
  await client.post(`/attempts/${attempt}/tasks/Q1/submit`, { choice: 'REVISE', finalArtifact: artifact(finalAnswer, finalCard), finalConfidence: 82 });
}

beforeAll(async () => {
  h = await harness({ participantType: 'judge', researchEnabled: true }, {}, { runJobs: ['GENERATE', 'RERUN'] });
  a = await h.client();
  ({ assignmentId } = await seedAssigned(h, a));
  attemptId = AttemptDTO.parse(await (await a.post(`/assignments/${assignmentId}/attempts`)).json()).attemptId;
  await answerQ1(a, attemptId, 1, 2, 0, 0);
  copyId = `${assignmentId}_copy`;
  await h.live.db.doc(`assignments/${copyId}`).set((await h.live.db.doc(`assignments/${assignmentId}`).get()).data()!);
  copyAttemptId = AttemptDTO.parse(await (await a.post(`/assignments/${copyId}/attempts`)).json()).attemptId;
}, 240_000);

afterAll(async () => {
  await h.live.db.doc(`assignments/${copyId}`).delete();
  await Promise.all(['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((slot) => h.live.db.doc(`researchRows/${copyAttemptId}_${slot}`).delete()));
  await h.live.db.doc(`participants/${a.session.uid}`).delete();
  await h.close();
});

describe('T14 tracking', () => {
  const tracking = async () => {
    const raw = await (await a.get(`/assignments/${assignmentId}/tracking`)).json();
    return { raw, body: ClassTrackingDTO.parse(raw) };
  };

  it('D02 tracking has no learning-gain field and passes the teacher scan', async () => {
    const { raw } = await tracking();
    expect(JSON.stringify(raw)).not.toMatch(/learningGain|gain/i);
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('counts and participants', async () => {
    const { body } = await tracking();
    expect(body.counts).toEqual({ started: 1, complete: 0 });
    expect(body.participants[0]).toMatchObject({ attemptId, status: 'IN_PROGRESS', submittedCount: 1, reviseCount: 1, keepCount: 0, isSimulated: false });
  });

  it('a person with no consent has no code', async () => {
    const { body } = await tracking();
    expect(body.participants[0]).not.toHaveProperty('participantCode');
  });

  it('perTask carries keep, revise, average confidence and delivered prompts', async () => {
    const { body } = await tracking();
    const q1 = body.perTask.find((t) => t.slot === 'Q1')!;
    expect(q1).toMatchObject({ submitted: 1, revise: 1, keep: 0, avgConfidenceBefore: 70, avgConfidenceAfter: 82 });
    expect(q1.deliveredChallenges).toEqual([{ label: 'TN1', count: 1 }]);
  });

  it('relation distribution counts only submitted attempts and states the denominator', async () => {
    const { body } = await tracking();
    expect(body.q1Relations).toMatchObject({ releaseLabel: 'r3', denominator: 1, after: { full: 1 } });
    expect(body.q1Relations.before.contradicts).toBe(1);
  });

  it('another workspace gets 404', async () => {
    const b = await h.client();
    expect((await b.get(`/assignments/${assignmentId}/tracking`)).status).toBe(404);
  });
});

describe('T15 trace', () => {
  it('trace shows student letter with authoring label, changes and the prompt', async () => {
    const raw = await (await a.get(`/attempts/${attemptId}/trace/Q1`)).json();
    const trace = TraceDTO.parse(raw);
    expect(trace.before.answer).toMatchObject({ letter: 'B', authoringLabel: 'A2' });
    expect(trace.before.evidence).toMatchObject({ letter: 'Card 3', authoringLabel: 'E3' });
    expect(trace.after.answer).toMatchObject({ letter: 'A', changed: true });
    expect(trace.challenge).toMatchObject({ label: 'TN1', studentChoice: 'REVISE' });
    expect(trace.slotChips[0]).toEqual({ slot: 'Q1', choice: 'REVISE' });
    expect(trace.slotChips[1]).toEqual({ slot: 'Q2', choice: null });
    expect(findRestrictedKeys(raw, 'teacher')).toEqual([]);
  });

  it('a trace in another workspace is 404', async () => {
    const b = await h.client();
    expect((await b.get(`/attempts/${attemptId}/trace/Q1`)).status).toBe(404);
  });
});

describe('me and consent', () => {
  it('new session has consentRequired true and the demo menu', async () => {
    const me = MeDTO.parse(await (await a.get('/me')).json());
    expect(me).toMatchObject({ uid: a.session.uid, consentRequired: true, demoMenu: true, role: 'demo', currentConsentVersion: '2026-10-v1' });
  });

  it('PATCH /me saves uiLocale on the workspace and rejects other values', async () => {
    const response = await a.patch('/me', { uiLocale: 'vi' });
    expect(MeDTO.parse(await response.json()).uiLocale).toBe('vi');
    expect((await a.patch('/me', { uiLocale: 'fr' })).status).toBe(400);
    await a.patch('/me', { uiLocale: 'en' });
  });

  it('submit with no participant record writes no row', async () => {
    const rows = await h.live.db.collection('researchRows').where('attemptId', '==', attemptId).get();
    expect(rows.empty).toBe(true);
  });

  it('a stale consent version is 400', async () => {
    expect((await a.post('/me/consent', { consentVersion: 'old', choice: 'AGREED' })).status).toBe(400);
  });

  it('agreeing issues a code and clears consentRequired', async () => {
    const result = ConsentResultDTO.parse(await (await a.post('/me/consent', { consentVersion: '2026-10-v1', choice: 'AGREED' })).json());
    expect(result.participantCode).toMatch(/^P-[A-Z0-9]{4}$/);
    expect(MeDTO.parse(await (await a.get('/me')).json())).toMatchObject({ consentRequired: false, participantCode: result.participantCode });
  });

  it('a different choice on the same version is 409', async () => {
    expect((await a.post('/me/consent', { consentVersion: '2026-10-v1', choice: 'DECLINED' })).status).toBe(409);
  });

  it('agreed submit writes one row with every column and no name', async () => {
    const before = await (await h.live.db.doc(`attempts/${copyAttemptId}`).get()).data();
    expect(before).toBeTruthy();
    const fresh = `${copyAttemptId}`;
    await answerQ1(a, fresh, 1, 2, 0, 0);
    const doc = (await h.live.db.doc(`researchRows/${fresh}_Q1`).get()).data()!;
    expect(doc).toMatchObject({ participant_type: 'judge', is_simulated: false, task: 'Q1', first_answer: 'B (A2)', first_evidence: 'Card 3 (E3)', first_relation: 'contradicts', final_answer: 'A (A1)', final_relation: 'full', first_confidence: 70, final_confidence: 82, confidence_change: 12, choice: 'REVISE', changed: 'answer, evidence', prompt_label: 'TN1', prompt_mode: 'NORMAL', run_number: 1, consent_version: '2026-10-v1', exportedAt: null });
    expect(JSON.stringify(doc)).not.toMatch(/Ms\. Lan|@/);
    expect(doc.seconds_to_lock).toBeGreaterThanOrEqual(0);
    expect(doc.material_hash).toHaveLength(12);
  });

  it('export is enqueued after the submit', async () => {
    expect(h.enqueued).toContainEqual(expect.objectContaining({ type: 'EXPORT_ROW', targetIds: [`${copyAttemptId}_Q1`] }));
  });

  it('Q5 row carries the full text', async () => {
    for (const [slot, artifact] of artifacts) {
      await a.post(`/attempts/${copyAttemptId}/tasks/${slot}/lock`, { artifact, initialConfidence: 60 });
      await a.post(`/attempts/${copyAttemptId}/tasks/${slot}/submit`, { choice: 'KEEP', finalArtifact: artifact, finalConfidence: 60 });
    }
    const doc = (await h.live.db.doc(`researchRows/${copyAttemptId}_Q5`).get()).data()!;
    expect(doc.first_answer).toContain('Open trade courses');
    expect(doc.first_answer).toContain('Many jobs need training');
    expect(doc.first_evidence).toBeNull();
  });
});
