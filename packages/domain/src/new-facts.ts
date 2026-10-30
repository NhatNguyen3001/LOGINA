import { normalizeText } from './normalize.js';

const NUMBER = /\d+(?:[.,]\d+)*(?:[–-]\d+(?:[.,]\d+)*)?%?/gu;
const CAPITALIZED_RUN = /\p{Lu}\p{L}*(?:\s+\p{Lu}\p{L}*)+/gu;

const numbersIn = (text: string): string[] => text.match(NUMBER) ?? [];

function isSentenceStart(text: string, index: number): boolean {
  return index === 0 || /[.!?:]\s*$/.test(text.slice(0, index));
}

/**
 * Capitalized runs of two or more words. The first word of a sentence is capitalized anyway, so it
 * is dropped when the rest still forms a name.
 */
function namesIn(text: string): { name: string; soleWord?: string }[] {
  return [...text.matchAll(CAPITALIZED_RUN)].map((match) => {
    const words = match[0].split(/\s+/);
    if (!isSentenceStart(text, match.index)) return { name: match[0] };
    const rest = words.slice(1);
    return rest.length >= 2 ? { name: rest.join(' ') } : { name: match[0], soleWord: rest[0]! };
  });
}

/** Numbers, years and names in `newText` that no approved evidence contains (X11). */
export function detectNewFacts(newText: string, approvedEvidenceTexts: string[]): string[] {
  const text = normalizeText(newText);
  const evidence = approvedEvidenceTexts.map(normalizeText).join(' ');
  const knownNumbers = new Set(numbersIn(evidence));

  const newNumbers = numbersIn(text).filter((n) => !knownNumbers.has(n));
  const newNames = namesIn(text)
    .filter(({ name, soleWord }) => !evidence.includes(name) && !(soleWord && evidence.includes(soleWord)))
    .map(({ name }) => name);

  return [...new Set([...newNumbers, ...newNames])];
}
