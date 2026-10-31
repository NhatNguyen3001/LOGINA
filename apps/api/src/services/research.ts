import { createHash } from 'node:crypto';
import { FieldValue, type DocumentData, type Firestore, type Timestamp, type Transaction } from 'firebase-admin/firestore';
import { Artifact, ResearchRow } from '@logina/contracts';
import { decodeNested } from '@logina/db';
import { answerColumns, buildResearchRow, materialHash, relationBucket, researchTime, type Q1Letters } from '@logina/domain';

/** A Reset reuses attempt IDs, so the run number keeps each run's row. Hashed, so no uid reaches the Sheet. */
export const researchRowId = (attemptId: string, slot: string, runNumber: number): string =>
  `row_${createHash('sha256').update(`${attemptId}:${slot}:${runNumber}`).digest('hex').slice(0, 32)}`;

export interface ResearchSettings {
  enabled: boolean;
  participantType: string;
}

const CARD_WORD = { en: 'Card', vi: 'Thẻ' };
const LETTERS = 'ABCD';

function lettersFor(release: DocumentData, locale: 'en' | 'vi'): Q1Letters {
  const content = release.publicContent as { answerOptions: { id: string }[]; evidenceOptions: { evidenceId: string }[] };
  const pairs = ((release.teacherContent?.pairs ?? []) as DocumentData[]);
  const answerAuthoring = (id: string): string => release.answerIdMap[id];
  const evidenceAuthoring = (id: string): string => release.evidenceIdMap[id];
  return {
    answerAuthoring,
    evidenceAuthoring,
    answerLetter: (id) => LETTERS[content.answerOptions.findIndex((a) => a.id === id)] ?? '?',
    cardLabel: (id) => `${CARD_WORD[locale]} ${content.evidenceOptions.findIndex((e) => e.evidenceId === id) + 1}`,
    relation: (answerId, evidenceId) => {
      const pair = pairs.find((p) => p.answerOptionId === answerAuthoring(answerId) && p.generatedEId === evidenceAuthoring(evidenceId));
      return relationBucket(pair?.pairAlignment as string);
    },
  };
}

/** Everything a row needs that doesn't change during the submit. Read before the transaction. */
export interface ResearchFacts {
  attempt: DocumentData;
  release: DocumentData;
  lesson: DocumentData;
  material: DocumentData;
  school: DocumentData;
}

export async function loadResearchFacts(db: Firestore, attempt: DocumentData, slot: string): Promise<ResearchFacts> {
  const lessonRef = db.doc(`lessons/${attempt.lessonId as string}`);
  const lesson = (await lessonRef.get()).data()!;
  const [release, material, school] = await Promise.all([
    db.doc(`lessons/${attempt.lessonId as string}/taskReleases/${attempt.releaseIds[slot] as string}`).get(),
    db.doc(`lessons/${attempt.lessonId as string}/materialVersions/${lesson.currentMaterialVersionId as string}`).get(),
    db.doc(`schools/${attempt.schoolId as string}`).get(),
  ]);
  return { attempt, release: decodeNested(release.data()!), lesson, material: material.data()!, school: school.data()! };
}

/** Called inside the submit transaction, after its reads. A person who didn't agree gets no row. */
export function writeResearchRow(
  db: Firestore,
  tx: Transaction,
  input: {
    facts: ResearchFacts;
    participant: DocumentData;
    settings: ResearchSettings;
    slot: string;
    task: DocumentData;
    delivery: DocumentData;
    final: Artifact;
    finalConfidence: number;
    choice: 'KEEP' | 'REVISE';
    changedElements: string[];
    now: Date;
  },
): string {
  const { facts, participant, settings, slot, task, delivery, final, finalConfidence, choice, changedElements, now } = input;
  const { attempt, release, lesson, material, school } = facts;
  const hash = materialHash((material.sha256 as string | undefined) || (attempt.lessonId as string));
  const runNumber = ((participant.runs?.[hash]?.[slot] as number | undefined) ?? 0) + 1;
  const locale = lesson.contentLocale as 'en' | 'vi';
  const letters = lettersFor(release, locale);
  const lockedAt = (task.lockedAt as Timestamp).toDate();
  const openedAt = (task.openedAt as Timestamp | undefined)?.toDate() ?? lockedAt;
  const rowId = researchRowId(attempt.id as string, slot, runNumber);

  const row = ResearchRow.parse(
    buildResearchRow({
      row_id: rowId,
      participant_code: participant.participantCode,
      participant_type: settings.participantType,
      is_simulated: participant.isSimulated === true,
      consent_version: participant.consentVersion,
      consent_at: researchTime((participant.consentAt as Timestamp).toDate()),
      interface_language: school.uiLocale,
      material_hash: hash,
      material_title: material.title,
      run_number: runNumber,
      lesson_id: attempt.lessonId,
      lesson_type: lesson.aiMode,
      content_language: locale,
      task: slot as ResearchRow['task'],
      task_type: release.teacherContent?.taskType ?? taskTypeOf(slot),
      release: release.releaseLabel,
      first: answerColumns(Artifact.parse(task.initialArtifact), letters),
      final: answerColumns(final, letters),
      first_confidence: task.initialConfidence,
      locked_at: researchTime(lockedAt),
      prompt_label: delivery.challengeLabel,
      prompt_mode: delivery.mode,
      choice,
      changed: changedElements.join(', '),
      final_confidence: finalConfidence,
      submitted_at: researchTime(now),
      seconds_to_lock: Math.max(0, Math.round((lockedAt.getTime() - openedAt.getTime()) / 1000)),
      seconds_to_submit: Math.max(0, Math.round((now.getTime() - lockedAt.getTime()) / 1000)),
    }),
  );

  tx.set(db.doc(`researchRows/${rowId}`), { ...row, attemptId: attempt.id, exportedAt: null });
  tx.set(db.doc(`participants/${attempt.studentId as string}`), { runs: { [hash]: { [slot]: FieldValue.increment(1) } } }, { merge: true });
  return rowId;
}

const TASK_TYPES: Record<string, ResearchRow['task_type']> = {
  Q1: 'JUDGMENT_EVIDENCE',
  Q2: 'EVIDENCE_RANKING',
  Q3: 'COMPARE_TRADEOFF',
  Q4: 'COUNTERARGUMENT',
  Q5: 'OPEN_PROPOSAL',
};
const taskTypeOf = (slot: string): ResearchRow['task_type'] => TASK_TYPES[slot]!;
