import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { studentTexts, type DraftFixture, type TextPair } from '@logina/domain';
import { generateStructured } from '../ai/model.js';
import { TranslationCheckOutput, TranslatorOutput, type TranslationFinding } from '../ai/schemas.js';
import { JobFailure } from '../errors.js';
import type { JobContext } from '../worker.js';

type Locale = 'en' | 'vi';

const LANGUAGE = { en: 'English', vi: 'Vietnamese' };

const otherLocale = (locale: Locale): Locale => (locale === 'en' ? 'vi' : 'en');

const statusOf = (findings: TranslationFinding[]) => {
  if (findings.some((finding) => finding.status === 'BLOCKER')) return 'BLOCKED';
  return findings.length > 0 ? 'NEEDS_REVIEW' : 'READY';
};

const tokens = (text: string): string[] => (text.match(/\[[^\]]+\]/g) ?? []).sort();

/** Q4 templates fill in [blanks] by name, so a changed token would show raw to a student. */
const tokenFindings = (pairs: TextPair[]): TranslationFinding[] =>
  pairs
    .filter(({ from, to }) => tokens(from).join() !== tokens(to).join())
    .map(({ from }) => ({ status: 'BLOCKER', findingCode: 'TEMPLATE_TOKEN_CHANGED', text: from, explanationForTeacher: 'A [blank] in this line changed. Keep each [blank] exactly as it is in the original.' }));

const translationRef = (db: Firestore, lessonId: string, slot: string) => db.doc(`lessons/${lessonId}/taskTranslations/${slot}`);

/** Runs before a draft can be approved, so a new draft is never paired with its old translation. */
export async function beginTranslation(context: Pick<JobContext, 'deps' | 'lesson'>, slot: string, draftId: string): Promise<void> {
  const { db } = context.deps;
  const ref = translationRef(db, context.lesson.id as string, slot);
  await db.runTransaction(async (tx) => {
    const previous = (await tx.get(ref)).data();
    tx.set(ref, {
      texts: [],
      keywords: {},
      findings: [],
      locale: otherLocale(context.lesson.contentLocale as Locale),
      ...previous,
      slot,
      draftId,
      status: 'WORKING',
      version: ((previous?.version as number | undefined) ?? 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/** A job that stops early must not leave a task waiting forever. */
export async function failTranslation(context: Pick<JobContext, 'deps' | 'lesson'>, slot: string): Promise<void> {
  const { db } = context.deps;
  const ref = translationRef(db, context.lesson.id as string, slot);
  await db.runTransaction(async (tx) => {
    const previous = (await tx.get(ref)).data();
    if (previous?.status === 'WORKING') tx.update(ref, { status: 'FAILED', version: (previous.version as number) + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}

export interface Kept {
  texts: TextPair[];
  keywords: Record<string, string[]>;
}

/** Runs after a draft is saved. `kept` holds wording to keep, so only new text goes to the AI. */
export async function translateTask(context: Pick<JobContext, 'deps' | 'lesson'>, draft: DraftFixture, draftId: string, kept?: Kept): Promise<void> {
  const { deps, lesson } = context;
  const { db, genai, config } = deps;
  const lessonId = lesson.id as string;
  const locale = otherLocale(lesson.contentLocale as Locale);
  const variables = { from: LANGUAGE[lesson.contentLocale as Locale], to: LANGUAGE[locale] };
  const texts = studentTexts(draft);
  const keep = (kept?.texts ?? []).filter((pair) => texts.includes(pair.from));
  const pending = texts.filter((text) => !keep.some((pair) => pair.from === text));
  const keywords = (draft.taskBody?.keywordPartitions ?? {}) as Record<string, string[]>;
  const ref = translationRef(db, lessonId, draft.slot);
  const startVersion = (((await ref.get()).data()?.version as number | undefined) ?? 0);

  /** Drops the write if the draft was replaced or a teacher changed the translation since this run began. */
  const save = (fields: object) =>
    db.runTransaction(async (tx) => {
      const [current, lessonDoc] = [await tx.get(ref), await tx.get(db.doc(`lessons/${lessonId}`))];
      const currentDraft = lessonDoc.data()?.currentTaskDraftIds?.[draft.slot] as string | undefined;
      if ((current.data()?.version ?? 0) !== startVersion || (currentDraft && currentDraft !== draftId)) return;
      tx.set(ref, { ...fields, slot: draft.slot, draftId, locale, version: startVersion + 1, updatedAt: FieldValue.serverTimestamp() });
    });

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
    const pairs = [...keep, ...pending.map((from, index) => ({ from, to: translated.texts[index]! }))];
    const { findings } = await generateStructured(genai, config, {
      role: 'translationCheck',
      schema: TranslationCheckOutput,
      variables,
      text: JSON.stringify({ texts: pairs, keywords: { original: keywords, translated: translated.keywords } }),
    });
    const version = startVersion + 1;
    /** Numbered per version, so accepting a finding never clears a new one. */
    const numbered = [...tokenFindings(pairs), ...findings].map((finding, index) => ({ ...finding, findingCode: `v${version}-${index}-${finding.findingCode}` }));
    await save({ status: statusOf(numbered), texts: pairs, keywords: translated.keywords, findings: numbered });
  } catch (error) {
    if (!(error instanceof JobFailure)) throw error;
    await save({ status: 'FAILED', texts: kept?.texts ?? [], keywords: kept?.keywords ?? {}, findings: [] });
  }
}

/** Keeps wording already there and runs the check again; `fresh` starts over for a blocked translation. */
export async function runTranslate(context: JobContext, loadDraft: (draftId: string) => Promise<DraftFixture>): Promise<void> {
  const { deps, lesson, job, mode } = context;
  if (mode !== 'LIVE') return;
  for (const slot of job.targetIds as string[]) {
    try {
      await context.step(`translate ${slot}`, async () => {
        const draftId = lesson.currentTaskDraftIds[slot] as string;
        const current = (await translationRef(deps.db, lesson.id as string, slot).get()).data();
        const kept = job.fresh === true || !current ? undefined : { texts: current.texts as TextPair[], keywords: current.keywords as Record<string, string[]> };
        await translateTask(context, await loadDraft(draftId), draftId, kept);
      });
    } catch (error) {
      await failTranslation(context, slot);
      throw error;
    }
  }
}
