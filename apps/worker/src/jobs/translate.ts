import { FieldValue } from 'firebase-admin/firestore';
import { studentTexts, type DraftFixture, type TextPair } from '@logina/domain';
import { generateStructured } from '../ai/model.js';
import { TranslationCheckOutput, TranslatorOutput, type TranslationFinding } from '../ai/schemas.js';
import { JobFailure } from '../errors.js';
import type { JobContext } from '../worker.js';

const LANGUAGE = { en: 'English', vi: 'Vietnamese' };

const statusOf = (findings: TranslationFinding[]) => {
  if (findings.some((finding) => finding.status === 'BLOCKER')) return 'BLOCKED';
  return findings.length > 0 ? 'NEEDS_REVIEW' : 'READY';
};

export interface Kept {
  texts: TextPair[];
  keywords: Record<string, string[]>;
  /** A teacher changed a line: nothing is new, but the check must run again. */
  recheck?: boolean;
}

/** Runs after a draft is saved. `kept` holds pairs from before an edit, so only new wording goes to the AI. */
export async function translateTask(context: Pick<JobContext, 'deps' | 'lesson'>, draft: DraftFixture, draftId: string, kept?: Kept): Promise<void> {
  const { deps, lesson } = context;
  const { db, genai, config } = deps;
  const original = lesson.contentLocale as 'en' | 'vi';
  const locale = original === 'en' ? 'vi' : 'en';
  const variables = { from: LANGUAGE[original], to: LANGUAGE[locale] };
  const texts = studentTexts(draft);
  const keep = kept?.texts ?? [];
  const pending = texts.filter((text) => !keep.some((pair) => pair.from === text));
  const keywords = (draft.taskBody?.keywordPartitions ?? {}) as Record<string, string[]>;
  const ref = db.doc(`lessons/${lesson.id as string}/taskTranslations/${draft.slot}`);
  if (keep.length > 0 && pending.length === 0 && !kept?.recheck) {
    await ref.update({ draftId });
    return;
  }
  const shared = { slot: draft.slot, draftId, locale, version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() };

  try {
    const translated =
      pending.length === 0
        ? { texts: [], keywords: kept?.keywords ?? {} }
        : await generateStructured(genai, config, {
            role: 'translator',
            schema: TranslatorOutput,
            variables,
            text: JSON.stringify({ texts: pending, keywords }),
          });
    if (translated.texts.length !== pending.length) throw new JobFailure('AI_FAILED');
    const fresh = pending.map((from, index) => ({ from, to: translated.texts[index]! }));
    const pairs = [...keep.filter((pair) => texts.includes(pair.from)), ...fresh];
    const { findings } = await generateStructured(genai, config, {
      role: 'translationCheck',
      schema: TranslationCheckOutput,
      variables,
      text: JSON.stringify({ texts: pairs, keywords: translated.keywords }),
    });
    await ref.set({ ...shared, status: statusOf(findings), texts: pairs, keywords: translated.keywords, findings });
  } catch (error) {
    if (!(error instanceof JobFailure)) throw error;
    await ref.set({ ...shared, status: 'FAILED', texts: [], keywords: {}, findings: [] });
  }
}

/** A retry starts over; a recheck keeps the teacher's wording and only runs the check. */
export async function runTranslate(context: JobContext, loadDraft: (draftId: string) => Promise<DraftFixture>): Promise<void> {
  const { deps, lesson, job } = context;
  for (const slot of job.targetIds as string[]) {
    await context.step(`translate ${slot}`, async () => {
      const draftId = lesson.currentTaskDraftIds[slot] as string;
      const current = (await deps.db.doc(`lessons/${lesson.id as string}/taskTranslations/${slot}`).get()).data();
      const recheck = job.recheck === true;
      await translateTask(context, await loadDraft(draftId), draftId, recheck ? { texts: current?.texts ?? [], keywords: current?.keywords ?? {}, recheck } : undefined);
    });
  }
}
