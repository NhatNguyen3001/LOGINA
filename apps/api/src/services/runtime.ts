import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { Artifact, type AttemptDTO, type StudentChallengeDTO, type SubmitResultDTO } from '@logina/contracts';
import { AppError, decodeNested, moveTree, newId, scopedGet, writeOnce } from '@logina/db';
import { buildLockFacts, compareArtifacts, selectChallenge, type Q1Labels, type RuleBundle } from '@logina/domain';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const LETTERS = 'ABCD';

import { loadResearchFacts, writeResearchRow, type ResearchSettings } from './research.js';

export interface Actor {
  schoolId: string;
  uid: string;
}

const notFound = (): AppError => new AppError('NOT_FOUND', 404, 'Not found.');
const attemptIdFor = (studentId: string, assignmentId: string): string => `att_${studentId}_${assignmentId}`;

export async function startAttempt(db: Firestore, actor: Actor, assignmentId: string, extra: DocumentData = {}): Promise<AttemptDTO> {
  const participant = (await db.doc(`participants/${actor.uid}`).get()).data();
  const assignment = await scopedGet(db.doc(`assignments/${assignmentId}`), actor.schoolId);
  if (!assignment) throw notFound();

  const attemptId = attemptIdFor(actor.uid, assignmentId);
  const ref = db.doc(`attempts/${attemptId}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, {
      ...(participant?.consent === 'AGREED' ? { participantCode: participant.participantCode } : {}),
      ...extra,
      schoolId: actor.schoolId,
      assignmentId,
      assignmentRevision: assignment.revision,
      lessonId: assignment.lessonId,
      studentId: actor.uid,
      releaseIds: assignment.releaseIds,
      status: 'NOT_STARTED',
      submittedCount: 0,
      startedAt: FieldValue.serverTimestamp(),
    });
    for (const slot of SLOTS) tx.create(ref.collection('tasks').doc(slot), { phase: 'REASON', draftArtifact: null });
  });

  const tasks = await ref.collection('tasks').get();
  const phases = new Map(tasks.docs.map((doc) => [doc.id, doc.data().phase as string]));
  const status = (await ref.get()).data()?.status as AttemptDTO['status'];
  return { attemptId, status, slots: SLOTS.map((slot) => ({ slot, phase: phases.get(slot) as AttemptDTO['slots'][number]['phase'] })) };
}

/**
 * Files a finished attempt as a recorded run so the same person can go again. The recorded copy has
 * no assignmentId, so class tracking never counts it. An unfinished attempt simply resumes.
 */
export async function restartAttempt(db: Firestore, actor: Actor, assignmentId: string): Promise<AttemptDTO> {
  const ref = db.doc(`attempts/${attemptIdFor(actor.uid, assignmentId)}`);
  const attempt = (await ref.get()).data();
  if (attempt?.status !== 'COMPLETE') return startAttempt(db, actor, assignmentId);

  const run = (attempt.run as number | undefined) ?? 1;
  await moveTree(db, ref, db.doc(`${ref.path}_run${run}`), ({ assignmentId: _filed, ...rest }) => ({ ...rest, run }));
  return startAttempt(db, actor, assignmentId, { run: run + 1 });
}

export async function loadAttempt(db: Firestore, actor: Actor, attemptId: string): Promise<DocumentData> {
  const attempt = await scopedGet(db.doc(`attempts/${attemptId}`), actor.schoolId);
  if (!attempt || attempt.studentId !== actor.uid) throw notFound();
  return attempt;
}

export async function loadRelease(db: Firestore, attempt: DocumentData, slot: string): Promise<DocumentData> {
  const releaseId = attempt.releaseIds?.[slot] as string | undefined;
  if (!releaseId) throw notFound();
  return decodeNested((await db.doc(`lessons/${attempt.lessonId as string}/taskReleases/${releaseId}`).get()).data()!);
}

/** Runtime IDs are all a browser ever sees; here they turn back into authoring IDs. */
function toAuthoring(artifact: Artifact, release: DocumentData): Artifact {
  if (artifact.slot !== 'Q1') return artifact;
  const answerId = release.answerIdMap[artifact.answerId] as string | undefined;
  const evidenceId = release.evidenceIdMap[artifact.evidenceId] as string | undefined;
  if (!answerId || !evidenceId) throw new AppError('UNKNOWN_OPTION', 400, 'That option is not part of this task.');
  return { ...artifact, answerId, evidenceId };
}

function q1Labels(release: DocumentData): Q1Labels {
  const content = release.teacherContent as { answers: DocumentData[]; evidence: DocumentData[]; pairs: DocumentData[] };
  return {
    answers: Object.fromEntries(content.answers.map((a) => [a.answerOptionId, a.answerCorrectness])),
    evidence: Object.fromEntries(content.evidence.map((e) => [e.generatedEId, e.qualityRelativeToCorrectA])),
    pairs: Object.fromEntries(content.pairs.map((p) => [`${p.answerOptionId as string}__${p.generatedEId as string}`, p.pairAlignment])),
  };
}

export function artifactSummary(artifact: Artifact, release: DocumentData): { answerText: string; evidenceText?: string } {
  if (artifact.slot === 'Q1') {
    const content = release.publicContent as { answerOptions: { id: string; text: string }[]; evidenceOptions: { evidenceId: string; text: string }[] };
    return {
      answerText: content.answerOptions.find((a) => a.id === artifact.answerId)?.text ?? '',
      evidenceText: content.evidenceOptions.find((e) => e.evidenceId === artifact.evidenceId)?.text ?? '',
    };
  }
  if (artifact.slot === 'Q5') return { answerText: artifact.proposal };
  const body = (release.publicContent as DocumentData).taskBody as DocumentData;
  if (artifact.slot === 'Q2') {
    const cards = body.cards as { cardId: string; text: string }[];
    return { answerText: artifact.orderedCardIds.map((id) => cards.find((card) => card.cardId === id)?.text ?? '').join(' > ') };
  }
  if (artifact.slot === 'Q3') return { answerText: (body.options as { optionId: string; text: string }[]).find((o) => o.optionId === artifact.judgmentOptionId)?.text ?? '' };
  return { answerText: (body.templates as { templateId: string; text: string }[]).find((x) => x.templateId === artifact.templateId)?.text ?? '' };
}

const toChallengeDTO = (taskDoc: DocumentData, delivery: DocumentData, deliveryId: string, release: DocumentData): StudentChallengeDTO => ({
  deliveryId,
  message: delivery.renderedMessage,
  lockedSummary: { ...artifactSummary(Artifact.parse(taskDoc.initialArtifact), release), confidence: taskDoc.initialConfidence },
});

/** One transaction: the locked answer and its one prompt are stored together or not at all. */
export async function lockTask(
  db: Firestore,
  actor: Actor,
  attemptId: string,
  slot: string,
  { artifact, initialConfidence }: { artifact: Artifact; initialConfidence: number },
): Promise<StudentChallengeDTO> {
  const attempt = await loadAttempt(db, actor, attemptId);
  const release = await loadRelease(db, attempt, slot);
  if (artifact.slot !== slot) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
  const authoring = toAuthoring(artifact, release);

  const bundle = (await db.doc(`lessons/${attempt.lessonId as string}/ruleBundles/${release.ruleBundleId as string}`).get()).data() as RuleBundle;
  const facts = buildLockFacts(authoring, slot === 'Q1' ? q1Labels(release) : { answers: {}, evidence: {}, pairs: {} }, release.serverBody?.keywordPartitions);
  const selection = selectChallenge(bundle, facts);
  const candidates = (release.teacherContent as { candidates: DocumentData[] }).candidates;
  const chosen = candidates.find((c) => c.challengeId === selection.challengeId);
  if (!chosen) throw new Error(`Release has no prompt ${selection.challengeId}`);

  const taskRef = db.doc(`attempts/${attemptId}/tasks/${slot}`);
  const deliveryId = newId('dlv');
  return db.runTransaction(async (tx) => {
    const task = (await tx.get(taskRef)).data()!;
    if (task.lockedAt) {
      const existing = (await tx.get(taskRef.collection('deliveries').doc(task.deliveryId as string))).data()!;
      return toChallengeDTO(task, existing, task.deliveryId as string, release);
    }
    const delivery = {
      challengeId: chosen.challengeId,
      challengeLabel: chosen.label,
      draftVersion: release.draftVersion,
      mode: selection.mode,
      renderedMessage: chosen.message,
      lockArtifactFacts: facts,
      triggerEvaluations: selection.evaluations,
      eligibleIds: selection.evaluations.filter((e) => e.matched).map((e) => e.challengeId),
      selectedAt: FieldValue.serverTimestamp(),
    };
    tx.update(taskRef, {
      phase: 'CHALLENGED',
      initialArtifact: artifact,
      initialConfidence,
      lockedAt: FieldValue.serverTimestamp(),
      deliveryId,
    });
    writeOnce(tx, taskRef.collection('deliveries').doc(deliveryId), delivery);
    if (attempt.status === 'NOT_STARTED') tx.update(db.doc(`attempts/${attemptId}`), { status: 'IN_PROGRESS' });
    return toChallengeDTO({ initialArtifact: artifact, initialConfidence }, delivery, deliveryId, release);
  });
}

export async function submitTask(
  db: Firestore,
  actor: Actor,
  attemptId: string,
  slot: string,
  { choice, finalArtifact, finalConfidence }: { choice: 'KEEP' | 'REVISE'; finalArtifact: Artifact; finalConfidence: number },
  research?: ResearchSettings,
): Promise<SubmitResultDTO & { researchRowId?: string }> {
  const attempt = await loadAttempt(db, actor, attemptId);
  if (finalArtifact.slot !== slot) throw new AppError('INVALID_REQUEST', 400, 'The request is not valid.');
  toAuthoring(finalArtifact, await loadRelease(db, attempt, slot));
  const facts = research?.enabled ? await loadResearchFacts(db, attempt, slot) : null;
  const taskRef = db.doc(`attempts/${attemptId}/tasks/${slot}`);
  const attemptRef = db.doc(`attempts/${attemptId}`);

  return db.runTransaction(async (tx) => {
    const task = (await tx.get(taskRef)).data()!;
    const current = (await tx.get(attemptRef)).data()!;
    const participant = (await tx.get(db.doc(`participants/${attempt.studentId as string}`))).data();
    if (!task.lockedAt) throw new AppError('NOT_LOCKED', 409, 'Lock in the answer first.');
    if (task.submittedAt) throw new AppError('ALREADY_SUBMITTED', 409, 'This task was already submitted.');

    const initial = Artifact.parse(task.initialArtifact);
    const final = choice === 'KEEP' ? initial : finalArtifact;
    const { revised, changedElements } = compareArtifacts(initial, final);
    const recordedChoice = revised ? 'REVISE' : 'KEEP';
    const delivery = task.deliveryId ? (await tx.get(taskRef.collection('deliveries').doc(task.deliveryId as string))).data() : undefined;
    const submittedCount = (current.submittedCount as number) + 1;
    const attemptStatus = submittedCount === SLOTS.length ? 'COMPLETE' : 'IN_PROGRESS';

    tx.update(taskRef, {
      phase: 'SUBMITTED',
      choice: recordedChoice,
      finalArtifact: final,
      finalConfidence,
      confidenceDelta: finalConfidence - (task.initialConfidence as number),
      changedElements,
      submittedAt: FieldValue.serverTimestamp(),
    });
    tx.update(attemptRef, {
      submittedCount,
      status: attemptStatus,
      ...(attemptStatus === 'COMPLETE' ? { completedAt: FieldValue.serverTimestamp() } : {}),
    });

    const researchRowId =
      facts && research && participant?.consent === 'AGREED' && delivery
        ? writeResearchRow(db, tx, { facts, participant, settings: research, slot, task, delivery, final, finalConfidence, choice: recordedChoice, changedElements, now: new Date() })
        : undefined;

    const next = SLOTS[SLOTS.indexOf(slot as (typeof SLOTS)[number]) + 1];
    return { ...(researchRowId ? { researchRowId } : {}), slot: slot as SubmitResultDTO['slot'], recordedChoice, attemptStatus, ...(attemptStatus !== 'COMPLETE' && next ? { nextSlot: next } : {}) };
  });
}

export function answerLabel(artifact: Artifact, release: DocumentData, cardWord: string): string {
  if (artifact.slot !== 'Q1') return artifact.slot;
  const content = release.publicContent as { answerOptions: { id: string }[]; evidenceOptions: { evidenceId: string }[] };
  const letter = LETTERS[content.answerOptions.findIndex((a) => a.id === artifact.answerId)];
  const card = content.evidenceOptions.findIndex((e) => e.evidenceId === artifact.evidenceId) + 1;
  return `${letter} · ${cardWord} ${card}`;
}

export { toChallengeDTO };
