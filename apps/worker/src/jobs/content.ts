import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { encodeNested } from '@logina/db';
import {
  aggregateGates,
  canonicalHash,
  checkCoverage,
  detectNewFacts,
  type DraftFixture,
  type LockFacts,
  type QualityGate,
  type ReportFixture,
  type RuleBundle,
} from '@logina/domain';

const SCHEMA_VERSION = 1;

type Bundle = Omit<RuleBundle, 'ruleBundleId'>;

export interface SavedDraft {
  draftId: string;
  bundleHash: string;
  ruleBundleId: string;
}

/** IDs come from the lesson, slot and version, so a retried job rewrites the same documents. */
export const draftIdFor = (lessonId: string, slot: string, draftVersion: number): string =>
  `tdr_${lessonId}_${slot}_v${draftVersion}`;

export async function saveDraft(
  db: Firestore,
  lesson: DocumentData,
  fixture: DraftFixture,
  bundle: Bundle,
  createdBy: string,
  parentDraftId?: string,
): Promise<SavedDraft> {
  const { generatedE = [], pairAlignments = [], challengeCandidates, feedback, ...fields } = fixture;
  const lessonRef = db.doc(`lessons/${lesson.id as string}`);
  const draftId = draftIdFor(lesson.id as string, fixture.slot, fixture.draftVersion);
  const draftRef = lessonRef.collection('taskDrafts').doc(draftId);

  const ruleBundleId = `rb_${draftId}`;
  const bundleHash = canonicalHash({ schemaVersion: SCHEMA_VERSION, ...bundle });
  const contentHash = canonicalHash({
    schemaVersion: SCHEMA_VERSION,
    questionStem: fixture.questionStem,
    answerOptions: fixture.answerOptions?.map((a) => ({ id: a.answerOptionId, text: a.text })),
    evidence: generatedE.map((e) => ({ id: e.generatedEId, text: e.text })),
    taskBody: fixture.taskBody,
  });

  const batch = db.batch();
  batch.set(draftRef, {
    ...encodeNested(fields),
    feedback,
    status: 'VALIDATING',
    sourceModelVersionId: lesson.currentSourceModelVersionId,
    intentVersionId: lesson.currentIntentVersionId,
    contentHash,
    createdBy,
    ruleBundleId,
    ...(parentDraftId ? { parentDraftId } : {}),
  });
  batch.set(lessonRef.collection('ruleBundles').doc(ruleBundleId), { ...bundle, hash: bundleHash });
  for (const card of generatedE) batch.set(draftRef.collection('generatedE').doc(card.generatedEId), card);
  for (const pair of pairAlignments) {
    batch.set(draftRef.collection('pairAlignments').doc(`${pair.answerOptionId}__${pair.generatedEId}`), pair);
  }
  for (const candidate of challengeCandidates) {
    batch.set(draftRef.collection('challengeCandidates').doc(candidate.challengeId), candidate);
  }
  batch.update(lessonRef, { [`currentTaskDraftIds.${fixture.slot}`]: draftId, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { draftId, bundleHash, ruleBundleId };
}

const check = (checkId: string, label: string, passed: boolean, affectedIds: string[] = []) => ({
  checkId,
  label,
  status: passed ? ('PASS' as const) : ('FAIL' as const),
  affectedIds,
});

const q1Combos = (draft: DraftFixture): LockFacts[] =>
  (draft.answerOptions ?? []).flatMap((a) =>
    (draft.generatedE ?? []).map((e) => ({ answerId: a.answerOptionId, evidenceId: e.generatedEId })),
  );

/** The checks code can settle. They run for real in every mode. */
export function deterministicChecks(draft: DraftFixture, bundle: Bundle, evidenceTexts: string[]) {
  const candidates = draft.challengeCandidates;
  const fallbacks = candidates.filter((c) => c.isNeutralFallback);
  const known = new Set(candidates.map((c) => c.challengeId));
  const coverage = checkCoverage({ ...bundle, ruleBundleId: 'check' }, draft.slot === 'Q1' ? q1Combos(draft) : [{}]);
  const results = [
    check('FALLBACK', 'Exactly one fallback prompt', fallbacks.length === 1),
    check('COVERAGE', 'Every choice gets exactly 1 Think-again prompt', coverage.ok),
    check('CANDIDATES', 'Every rule points at a known prompt', bundle.candidates.every((c) => known.has(c.challengeId))),
  ];
  if (draft.slot === 'Q1') {
    const a = draft.answerOptions ?? [];
    const e = draft.generatedE ?? [];
    results.push(
      check('STRUCT', '4 statements, 4 cards of the right types', a.length === 4 && e.length === 4),
      check('PAIRS', '16/16 statement × card pairs evaluated', (draft.pairAlignments ?? []).length === 16),
    );
  }
  if (evidenceTexts.length > 0) {
    const options = [...(draft.answerOptions ?? []).map((a) => a.text), ...(draft.generatedE ?? []).map((e) => e.text)];
    const added = options.flatMap((text) => detectNewFacts(text, evidenceTexts));
    results.push(check('NEW_FACTS', 'No new facts beyond the approved source', added.length === 0, added));
  }
  return results;
}

/** Stores the report and sets the draft status. An uncertain verdict is never a PASS. */
export async function saveReport(
  db: Firestore,
  lessonId: string,
  saved: SavedDraft,
  draft: DraftFixture,
  deterministic: ReportFixture['deterministic'],
  gates: ReportFixture['gates'],
  candidateSetVersion: number,
  validatorVersion: string,
): Promise<string> {
  const stamped: QualityGate[] = gates.map((gate) => ({
    ...gate,
    validatorVersion,
    checkedHash: saved.bundleHash,
  }));
  const aggregate = aggregateGates(stamped, deterministic);
  const contentManifestHash = canonicalHash({
    schemaVersion: SCHEMA_VERSION,
    questionStem: draft.questionStem,
    answers: draft.answerOptions?.map((a) => [a.answerOptionId, a.text]),
    evidence: draft.generatedE?.map((e) => [e.generatedEId, e.text]),
    taskBody: draft.taskBody,
    messages: draft.challengeCandidates.map((c) => [c.challengeId, c.message]),
    dependencyManifest: draft.dependencyManifest,
    ruleBundleHash: saved.bundleHash,
  });
  const previewHash = canonicalHash({
    contentManifestHash,
    ruleBundleHash: saved.bundleHash,
    aggregate,
    draftVersion: draft.draftVersion,
  });

  const reportId = `rep_${saved.draftId}_${candidateSetVersion}`;
  const lessonRef = db.doc(`lessons/${lessonId}`);
  const batch = db.batch();
  batch.set(lessonRef.collection('validationReports').doc(reportId), {
    taskDraftId: saved.draftId,
    draftVersion: draft.draftVersion,
    deterministic,
    gates: stamped,
    aggregate,
    contentManifestHash,
    ruleBundleHash: saved.bundleHash,
    previewHash,
    candidateSetVersion,
    createdAt: FieldValue.serverTimestamp(),
  });
  const status = aggregate === 'BLOCKED' ? 'BLOCKED' : aggregate;
  batch.update(lessonRef.collection('taskDrafts').doc(saved.draftId), { status, latestValidationReportId: reportId });
  await batch.commit();
  return reportId;
}
