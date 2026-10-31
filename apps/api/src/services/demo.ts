import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { copySnapshotIntoWorkspace, type WorkspaceIds } from '@logina/db';
import { createPrng, loadFixture, shuffleForRelease } from '@logina/domain';
import type { Artifact } from '@logina/contracts';
import type { FileStore } from '../context.js';
import { loadRelease, lockTask, startAttempt, submitTask } from './runtime.js';
import type { ResearchSettings } from './research.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
const SIMULATED_PARTICIPANTS = 7;
const REVISE_SHARE = 0.4;
const MAX_TEXT = 120;
const TENANT_COLLECTIONS = ['assignments', 'attempts', 'jobs', 'previewViews'];

/** Clears one workspace only. Research data, the daily cap and every other workspace stay untouched. */
export async function clearWorkspace(db: Firestore, files: FileStore, schoolId: string): Promise<void> {
  await db.doc(`schools/${schoolId}`).update({ readyAt: null, copyStartedAt: FieldValue.serverTimestamp(), failNextRerun: FieldValue.delete() });
  const lessons = await db.collection('lessons').where('schoolId', '==', schoolId).get();
  await Promise.all(
    lessons.docs.map(async (lesson) => {
      const materials = await lesson.ref.collection('materialVersions').get();
      await Promise.all(
        materials.docs
          .map((doc) => doc.data().storagePath as string)
          .filter((path) => path.startsWith('uploads/'))
          .map((path) => files.remove(path)),
      );
      await db.recursiveDelete(lesson.ref);
    }),
  );
  for (const name of TENANT_COLLECTIONS) {
    const docs = await db.collection(name).where('schoolId', '==', schoolId).get();
    await Promise.all(docs.docs.map((doc) => db.recursiveDelete(doc.ref)));
  }
}

export async function restoreWorkspace(db: Firestore, files: FileStore, target: WorkspaceIds, snapshotId?: string): Promise<void> {
  await clearWorkspace(db, files, target.schoolId);
  if (snapshotId) await copySnapshotIntoWorkspace(db, snapshotId, target);
  await db.doc(`schools/${target.schoolId}`).update({ readyAt: FieldValue.serverTimestamp() });
}

interface SimulatedTask {
  slot: (typeof SLOTS)[number];
  initial: DocumentData;
  initialConfidence: number;
  choice: 'KEEP' | 'REVISE';
  final: DocumentData;
  finalConfidence: number;
}

function toRuntime(slot: string, artifact: DocumentData, release: DocumentData): Artifact {
  if (slot !== 'Q1') return { ...artifact, slot } as Artifact;
  const reverse = (map: Record<string, string>, id: string) => Object.entries(map).find(([, authoring]) => authoring === id)?.[0];
  return { slot: 'Q1', answerId: reverse(release.answerIdMap, artifact.answerId)!, evidenceId: reverse(release.evidenceIdMap, artifact.evidenceId)! };
}

/** A LIVE lesson has no script, so a generator seeded by the lesson ID gives the same class every time. */
function randomTasks(lessonId: string, n: number, releases: Record<string, DocumentData>): SimulatedTask[] {
  const random = createPrng(`${lessonId}:${n}`);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;

  const answerFor = (slot: string, release: DocumentData): DocumentData => {
    const body = release.publicContent.taskBody;
    if (slot === 'Q1') {
      return {
        answerId: release.answerIdMap[pick(release.publicContent.answerOptions as { id: string }[]).id],
        evidenceId: release.evidenceIdMap[pick(release.publicContent.evidenceOptions as { evidenceId: string }[]).evidenceId],
      };
    }
    if (slot === 'Q2') return { orderedCardIds: shuffleForRelease(String(random()), (body.cards as { cardId: string }[]).map((c) => c.cardId)) };
    if (slot === 'Q3') {
      const option = pick(body.options as { optionId: string }[]).optionId;
      return {
        comparisons: (body.criteria as { criterionId: string }[]).map((c) => ({ criterionId: c.criterionId, value: option })),
        judgmentOptionId: option,
        tradeOffIds: [pick(body.constraints as { tradeOffId: string }[]).tradeOffId],
      };
    }
    if (slot === 'Q4') {
      const template = pick(body.templates as { templateId: string; slots: { slotId: string; choices: { choiceId: string }[] }[] }[]);
      return { templateId: template.templateId, slots: template.slots.map((s) => ({ slotId: s.slotId, choiceId: pick(s.choices).choiceId })) };
    }
    const text = (release.publicContent.questionStem as string).slice(0, MAX_TEXT);
    return { proposal: text, reason: text };
  };

  return SLOTS.map((slot) => {
    const initial = answerFor(slot, releases[slot]!);
    const revise = random() < REVISE_SHARE;
    const initialConfidence = 30 + Math.floor(random() * 61);
    return {
      slot,
      initial,
      initialConfidence,
      choice: revise ? 'REVISE' : 'KEEP',
      final: revise ? answerFor(slot, releases[slot]!) : initial,
      finalConfidence: Math.min(100, initialConfidence + Math.floor(random() * 21)),
    };
  });
}

/** Seven synthetic participants through the real runtime. Pressing it twice adds nobody. */
export async function simulateClass(
  db: Firestore,
  schoolId: string,
  assignment: DocumentData,
  lesson: DocumentData,
  research: ResearchSettings,
  onRow: (rowId: string) => Promise<void>,
): Promise<void> {
  const script =
    lesson.aiMode === 'SEEDED'
      ? (loadFixture('simulate-class', lesson.contentLocale as 'en' | 'vi') as { participantNumber: number; tasks: SimulatedTask[] }[])
      : null;

  const simulateParticipant = async (n: number): Promise<void> => {
    const uid = `sim_${assignment.id as string}_r${assignment.revision as number}_${n}`;
    const actor = { schoolId, uid };
    if ((await db.doc(`attempts/att_${uid}_${assignment.id as string}`).get()).exists) return;

    const participantCode = `P-SIM${n}`;
    await db.doc(`participants/${uid}`).set({ consent: 'AGREED', consentVersion: 'simulated', consentAt: FieldValue.serverTimestamp(), participantCode, isSimulated: true });
    const { attemptId } = await startAttempt(db, actor, assignment.id as string, { participantCode, isSimulated: true });
    const attempt = await db.doc(`attempts/${attemptId}`).get();
    const loaded = { id: attemptId, ...attempt.data() };
    const releases = Object.fromEntries(await Promise.all(SLOTS.map(async (slot) => [slot, await loadRelease(db, loaded, slot)] as const)));
    const tasks = script ? script.find((s) => s.participantNumber === n)!.tasks : randomTasks(lesson.id as string, n, releases);

    for (const task of tasks) {
      const release = releases[task.slot]!;
      await lockTask(db, actor, attemptId, task.slot, { artifact: toRuntime(task.slot, task.initial, release), initialConfidence: task.initialConfidence });
      const { researchRowId } = await submitTask(db, actor, attemptId, task.slot, { choice: task.choice, finalArtifact: toRuntime(task.slot, task.final, release), finalConfidence: task.finalConfidence }, research);
      if (researchRowId) await onRow(researchRowId);
    }
  };

  await Promise.all(Array.from({ length: SIMULATED_PARTICIPANTS }, (_, i) => simulateParticipant(i + 1)));
}
