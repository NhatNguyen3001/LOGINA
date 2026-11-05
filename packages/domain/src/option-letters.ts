const LETTERS = 'ABCDEFGH';
const VIETNAMESE = /[ăâđêôơưạảãáàặẳẵắằậẩẫấầẹẻẽéèệểễếềịỉĩíìọỏõóòộổỗốồợởỡớờụủũúùựửữứừỵỷỹýỳ]/i;
const WORDS = { en: { A: 'statement', E: 'card' }, vi: { A: 'nhận định', E: 'thẻ' } } as const;

/** Statements and cards are A1 and E1 inside LOGINA; students see them lettered A, B, C, so a prompt names them that way. */
export function letterOptionIds(text: string): string {
  const words = VIETNAMESE.test(text) ? WORDS.vi : WORDS.en;
  return text.replace(/(\b(?:statement|card|câu|thẻ|nhận định)\s+)?\b([AE])([1-8])\b/giu, (match, word: string | undefined, kind: string, n: string) => {
    const letter = LETTERS[Number(n) - 1]!;
    if (kind !== 'A' && kind !== 'E') return match;
    return word ? `${word}${letter}` : `${words[kind]} ${letter}`;
  });
}
