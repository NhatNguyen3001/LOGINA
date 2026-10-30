import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { decodeNested } from '@logina/db';
import type { DraftFixture, FixtureName, ReportFixture, RuleBundle } from '@logina/domain';
import { generateStructured, validatorVersion } from '../ai/model.js';
import { XReasonOutput } from '../ai/schemas.js';
import { JobFailure } from '../errors.js';
import type { JobContext } from '../worker.js';
import { deterministicChecks, saveDraft, saveReport } from './content.js';

const NEEDS_REVIEW = { en: 'Needs teacher review', vi: 'Cần giáo viên xem lại' };

interface ScriptedEdit {
  id: string;
  slot: string;
  editScope: string;
  payload: { optionId?: string; text?: string; challengeId?: string; message?: string };
  resultDraftFixture: FixtureName;
  resultReportFixture: FixtureName;
}

/** One-shot: reading the flag clears it, so only the next recheck fails. */
async function consumeFailNext(db: Firestore, schoolId: string): Promise<boolean> {
  const ref = db.doc(`schools/${schoolId}`);
  return db.runTransaction(async (tx) => {
    const armed = (await tx.get(ref)).data()?.failNextRerun === true;
    if (armed) tx.update(ref, { failNextRerun: FieldValue.delete() });
    return armed;
  });
}

const sameEdit = (scripted: ScriptedEdit, edit: DocumentData | undefined): boolean =>
  scripted.editScope === edit?.editScope &&
  Object.entries(scripted.payload).every(([key, value]) => edit?.payload?.[key] === value);

const needsReview = (gates: ReportFixture['gates'], locale: 'en' | 'vi'): ReportFixture['gates'] =>
  gates.map((gate) =>
    gate.status === 'BLOCKER'
      ? gate
      : { ...gate, status: 'REVIEW_REQUIRED', findingCodes: ['NEEDS_TEACHER_REVIEW'], explanationForTeacher: NEEDS_REVIEW[locale], overridable: true },
  );

async function loadDraft(context: JobContext, draftId: string): Promise<DraftFixture> {
  const draftRef = context.deps.db.doc(`lessons/${context.lesson.id}/taskDrafts/${draftId}`);
  const [draft, generatedE, pairs, candidates] = await Promise.all([
    draftRef.get(),
    draftRef.collection('generatedE').get(),
    draftRef.collection('pairAlignments').get(),
    draftRef.collection('challengeCandidates').get(),
  ]);
  return {
    ...decodeNested(draft.data() as DraftFixture),
    generatedE: generatedE.docs.map((d) => d.data() as NonNullable<DraftFixture['generatedE']>[number]),
    pairAlignments: pairs.docs.map((d) => d.data() as NonNullable<DraftFixture['pairAlignments']>[number]),
    challengeCandidates: candidates.docs.map((d) => d.data() as DraftFixture['challengeCandidates'][number]),
  };
}

export async function runRerun(context: JobContext): Promise<void> {
  const { deps, lesson, job, mode } = context;
  const { db, genai, config, loadFixture } = deps;
  const locale = lesson.contentLocale as 'en' | 'vi';
  const lessonId = lesson.id as string;

  for (const draftId of job.targetIds as string[]) {
    const draftRef = db.doc(`lessons/${lessonId}/taskDrafts/${draftId}`);

    if (await consumeFailNext(db, lesson.schoolId as string)) {
      await draftRef.update({ status: 'FAILED' });
      throw new JobFailure('TIMED_OUT');
    }

    const draft = await loadDraft(context, draftId);
    const previous = (await db.doc(`lessons/${lessonId}/validationReports/${(draft as unknown as DocumentData).latestValidationReportId as string}`).get()).data() as ReportFixture | undefined;
    const bundleDoc = (await db.doc(`lessons/${lessonId}/ruleBundles/${(draft as unknown as DocumentData).ruleBundleId as string}`).get()).data() as Omit<RuleBundle, 'ruleBundleId'>;
    const candidateSetVersion = (previous?.candidateSetVersion ?? 0) + 1;

    if (mode === 'SEEDED') {
      const scripted = (loadFixture('scripted-edits', locale) as ScriptedEdit[]).find((s) => sameEdit(s, job.edit));
      if (scripted) {
        const next = loadFixture(scripted.resultDraftFixture, locale) as DraftFixture;
        const report = loadFixture(scripted.resultReportFixture, locale) as ReportFixture;
        const saved = await saveDraft(db, lesson, next, bundleDoc, 'teacher', draftId);
        await draftRef.update({ status: 'SUPERSEDED' });
        await saveReport(db, lessonId, saved, next, deterministicChecks(next, bundleDoc, []), report.gates, report.candidateSetVersion, validatorVersion('xreason', config, true));
        continue;
      }
    }

    const saved = { draftId, bundleHash: (bundleDoc as unknown as { hash: string }).hash, ruleBundleId: (draft as unknown as DocumentData).ruleBundleId as string };
    const checks = deterministicChecks(draft, bundleDoc, []);
    const runLive = mode === 'LIVE' || config.liveAi;
    const gates = runLive
      ? await generateStructured(genai, config, {
          role: 'xreason',
          schema: XReasonOutput,
          variables: { locale },
          text: JSON.stringify({ draft: { ...draft, feedback: undefined } }),
        }).then(
          (result) => result.gates,
          () => needsReview(previous?.gates ?? [], locale),
        )
      : needsReview(previous?.gates ?? [], locale);
    await saveReport(db, lessonId, saved, draft, checks, gates, candidateSetVersion, validatorVersion('xreason', config, !runLive));
  }
}
