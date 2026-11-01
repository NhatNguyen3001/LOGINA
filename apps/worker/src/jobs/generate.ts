import type { DocumentData } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type { DraftFixture, FixtureName, ReportFixture, RuleBundle } from '@logina/domain';
import { generateStructured, validatorVersion } from '../ai/model.js';
import { generatorSchema, XReasonOutput } from '../ai/schemas.js';
import { JobFailure } from '../errors.js';
import type { JobContext } from '../worker.js';
import { deterministicChecks, saveDraft, saveReport } from './content.js';
import { beginTranslation, failTranslation, translateTask } from './translate.js';

const SLOTS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const;
type Slot = (typeof SLOTS)[number];

const SEEDED_DRAFT: Record<Slot, FixtureName> = { Q1: 'q1-v3', Q2: 'q2', Q3: 'q3', Q4: 'q4-v3', Q5: 'q5' };
const SEEDED_REPORT: Record<Slot, FixtureName> = {
  Q1: 'reports/q1-v3',
  Q2: 'reports/q2',
  Q3: 'reports/q3',
  Q4: 'reports/q4-v3',
  Q5: 'reports/q5',
};
const ASSESSMENT = { PASS: 'SUFFICIENT', REVIEW_REQUIRED: 'UNCERTAIN', BLOCKER: 'INSUFFICIENT' } as const;
const bundleName = (slot: Slot): FixtureName => `rule-bundles/${slot.toLowerCase()}` as FixtureName;

async function approvedSource(context: JobContext): Promise<{ text: string; evidenceTexts: string[] }> {
  const { deps, lesson } = context;
  const read = async (name: string) =>
    (await deps.db.collection(`lessons/${lesson.id}/${name}`).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const [units, claims, evidence] = await Promise.all([read('sourceUnits'), read('sourceClaims'), read('sourceEvidence')]);
  const text = JSON.stringify({ units, claims, evidence });
  return { text, evidenceTexts: (units as DocumentData[]).map((u) => u.text as string) };
}

export async function runGenerate(context: JobContext): Promise<void> {
  const { deps, lesson, job, mode } = context;
  const { db, genai, config, loadFixture } = deps;
  const locale = lesson.contentLocale as 'en' | 'vi';
  const targets: string[] = job.targetIds ?? [];
  const lessonRef = db.doc(`lessons/${lesson.id}`);

  if (mode === 'SEEDED') {
    const sufficiency = loadFixture('sufficiency', locale) as { slot: Slot; assessment: string }[];
    if (targets.length === 0) {
      await context.step('sufficiency', async () => {
        const batch = db.batch();
        for (const row of sufficiency) {
          batch.set(lessonRef.collection('taskSufficiency').doc(row.slot), {
            ...row,
            sourceModelVersionId: lesson.currentSourceModelVersionId,
            teacherChoice: null,
          });
        }
        await batch.commit();
      });
    }
    const paused = (slot: Slot) => sufficiency.find((row) => row.slot === slot)?.assessment !== 'SUFFICIENT';
    const slots = targets.length > 0 ? (targets as Slot[]) : SLOTS.filter((slot) => !paused(slot));

    for (const slot of slots) {
      await context.step(`draft ${slot}`, async () => {
        const draft = loadFixture(SEEDED_DRAFT[slot], locale) as DraftFixture;
        const bundle = loadFixture(bundleName(slot), locale) as Omit<RuleBundle, 'ruleBundleId'>;
        const report = loadFixture(SEEDED_REPORT[slot], locale) as ReportFixture;
        const saved = await saveDraft(db, lesson, draft, bundle, 'generator');
        const checks = deterministicChecks(draft, bundle, []);
        await saveReport(db, lesson.id as string, saved, draft, [...report.deterministic, ...checks], report.gates, report.candidateSetVersion, validatorVersion('xreason', config, true));
      });
    }
    await lessonRef.update({ updatedAt: FieldValue.serverTimestamp() });
    return;
  }

  const { text, evidenceTexts } = await approvedSource(context);
  /** A task the AI can't draft stays open for Regenerate, and the others still run. */
  const draftSlot = (slot: Slot) =>
    context.step(`draft ${slot}`, async () => {
      await context.checkpoint();
      const { draft, ruleBundle } = await generateStructured(genai, config, {
        role: 'generator',
        schema: generatorSchema(slot),
        variables: { slot, locale },
        text,
      });
      await context.checkpoint();
      const saved = await saveDraft(db, lesson, { ...draft, slot }, ruleBundle as Omit<RuleBundle, 'ruleBundleId'>, 'generator');
      await beginTranslation(context, slot, saved.draftId);
      const checks = deterministicChecks(draft, ruleBundle as Omit<RuleBundle, 'ruleBundleId'>, evidenceTexts);
      const { gates } = await generateStructured(genai, config, {
        role: 'xreason',
        schema: XReasonOutput,
        variables: { locale },
        text: JSON.stringify({ draft: { ...draft, feedback: undefined }, source: text }),
      });
      await context.checkpoint();
      await saveReport(db, lesson.id as string, saved, draft, checks, gates, 1, validatorVersion('xreason', config, false));
      const evidence = gates.find((gate) => gate.gateId === 'QG2');
      if (evidence) {
        await lessonRef.collection('taskSufficiency').doc(slot).set(
          {
            slot,
            assessment: ASSESSMENT[evidence.status],
            sourceRefs: evidence.sourceRefs.join(' · '),
            explanationForTeacher: evidence.explanationForTeacher,
            sourceModelVersionId: lesson.currentSourceModelVersionId,
          },
          { merge: true },
        );
      }
      await translateTask(context, { ...draft, slot }, saved.draftId);
    });

  const slots = targets.length > 0 ? (targets as Slot[]) : SLOTS;
  const results = await Promise.allSettled(slots.map(draftSlot));
  await Promise.all(slots.filter((_, index) => results[index]?.status === 'rejected').map((slot) => failTranslation(context, slot)));
  const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason as unknown] : []));
  const serious = failures.find((error) => !(error instanceof JobFailure && error.code === 'AI_FAILED'));
  if (serious) throw serious;
  if (failures.length > 0) throw failures[0];
}
