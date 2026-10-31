import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { applyTexts, sampleTexts, type TextPair } from '@logina/domain';

type Locale = 'en' | 'vi';

/** The language a student chose. It lives on the workspace, like the teacher's. */
export const studentLocale = async (db: Firestore, schoolId: string): Promise<Locale> =>
  ((await db.doc(`schools/${schoolId}`).get()).data()?.uiLocale ?? 'en') as Locale;

/** An approved translation in the release wins; the sample lesson has both languages built in. */
export function textsFor(lesson: DocumentData | undefined, locale: Locale, release?: DocumentData): TextPair[] {
  const original = (lesson?.contentLocale ?? 'en') as Locale;
  if (locale === original) return [];
  const stored = release?.translations?.[locale] as TextPair[] | undefined;
  if (stored?.length) return stored;
  return lesson?.aiMode === 'SEEDED' ? sampleTexts(original, locale) : [];
}

/** Only what a student reads changes. IDs and scoring data stay in the release as they are. */
export const localizeRelease = (release: DocumentData, texts: TextPair[]): DocumentData => ({
  ...release,
  publicContent: applyTexts(release.publicContent, texts),
  feedbackContent: applyTexts(release.feedbackContent, texts),
});
