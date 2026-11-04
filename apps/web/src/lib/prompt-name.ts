import type { TFunction } from 'i18next';

/** Rule IDs like TN2 or FB mean nothing to a teacher, so screens show "Prompt 2" or "Neutral prompt" instead. */
export function promptName(label: string, t: TFunction): string {
  const numbered = /^TN(\d+)$/.exec(label);
  if (numbered) return t('teacher.promptN', { n: Number(numbered[1]) });
  if (label === 'FB' || /^fallback$/i.test(label)) return t('teacher.promptFallback');
  return label;
}

/** AI-written notes can name a rule ID mid-sentence ("Prompt TN2 states..."), so each one is swapped for its plain name. */
export function withPromptNames(text: string, t: TFunction): string {
  return text
    .replace(/(?:\b(?:Prompt|Câu|Gợi ý)\s+)?\bTN(\d+)\b/g, (_, n: string) => t('teacher.promptN', { n: Number(n) }))
    .replace(/\bFB\b/g, () => t('teacher.promptFallback'));
}

/** Labels like "Wrong option · source refutes it" read as a short tag and a plain note, with no dot between. */
export function splitLabel(label: string): { tag: string; note: string } {
  const [tag = '', ...rest] = label.split(/\s+·\s+/);
  return { tag, note: rest.join(', ') };
}

const LETTERS = 'ABCDEFGH';
const OPTION_ID = /^([AE])(\d)$/;

/** Statements and cards are A1 and E1 inside LOGINA; students see them lettered A, B, C, so teachers do too. */
export function optionLetter(id: string): string {
  const match = OPTION_ID.exec(id);
  return match ? (LETTERS[Number(match[2]) - 1] ?? id) : id;
}

/** Notes written by the AI name statements and cards by their IDs ("A4 is easy...", "(E4)"); they read "statement D" and "card D". */
export function withOptionNames(text: string, t: TFunction, midSentence = false): string {
  return text.replace(/(?:\b(statement|card|Statement|Card|câu|Câu|thẻ|Thẻ)\s+)?\b([AE])(\d)\b/g, (match, _word: string | undefined, kind: string, n: string, offset: number) => {
    const letter = LETTERS[Number(n) - 1];
    if (!letter) return match;
    const name = t(kind === 'A' ? 'teacher.optionRef.statement' : 'teacher.optionRef.card', { letter });
    const startsSentence = (offset === 0 && !midSentence) || /[.!?]\s*$/.test(text.slice(0, offset));
    return startsSentence ? name.charAt(0).toUpperCase() + name.slice(1) : name;
  });
}

/** Everything a teacher reads from the AI goes through here: plain prompt names and lettered options. */
export function plainTeacherText(text: string, t: TFunction, midSentence = false): string {
  return withOptionNames(withPromptNames(text, t), t, midSentence);
}

const VIETNAMESE = /[ăâđêôơưạảãáàặẳẵắằậẩẫấầẹẻẽéèệểễếềịỉĩíìọỏõóòộổỗốồợởỡớờụủũúùựửữứừỵỷỹýỳ]/i;
const STUDENT_WORDS = { en: { A: 'statement', E: 'card' }, vi: { A: 'câu', E: 'thẻ' } } as const;

/** A prompt exactly as the student reads it: the same lettering the API applies (letterOptionIds in @logina/domain). */
export function asStudentSees(text: string): string {
  const words = VIETNAMESE.test(text) ? STUDENT_WORDS.vi : STUDENT_WORDS.en;
  return text.replace(/(\b(?:statement|card|câu|thẻ|nhận định)\s+)?\b([AE])([1-8])\b/giu, (match, word: string | undefined, kind: string, n: string) => {
    if (kind !== 'A' && kind !== 'E') return match;
    const letter = LETTERS[Number(n) - 1]!;
    return word ? `${word}${letter}` : `${words[kind]} ${letter}`;
  });
}
