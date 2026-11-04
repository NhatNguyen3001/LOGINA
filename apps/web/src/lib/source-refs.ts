import type { TFunction } from 'i18next';

const LOCATOR = /^([ptf])(\d+)-(\d+)$/;
const INTERNAL_ID = /^[a-z]+\d*_\w+$/i;
const KIND: Record<string, string> = { p: 'para', t: 'table', f: 'figure' };
/** "p. 8", "pp. 8–9" or the Vietnamese "tr. 8", with anything after the number. */
const PAGE = /^(pp?|tr)\.\s*([\d]+(?:\s*[–-]\s*\d+)?)\s*(.*)$/;
const PARAGRAPH = /\b(paras?)\.\s*([\d]+(?:\s*[–-]\s*\d+)?)/g;

/** Spells out the short forms a teacher would otherwise have to decode: "p. 8 para. 2" reads "Page 8, paragraph 2". */
function spellOut(part: string, t: TFunction): string {
  const locator = LOCATOR.exec(part);
  if (locator) return t(`teacher.sourceRef.${KIND[locator[1]!]}`, { page: locator[2], n: locator[3] });
  const words = part.replace(PARAGRAPH, (_, unit: string, n: string) => t(unit === 'paras' ? 'teacher.sourceRef.paragraphs' : 'teacher.sourceRef.paragraph', { n }));
  const page = PAGE.exec(words);
  if (!page) return words;
  const [, unit, n, rest] = page;
  const pages = t(unit === 'pp' || /[–-]/.test(n!) ? 'teacher.sourceRef.pages' : 'teacher.sourceRef.page', { n: n!.replace(/\s+/g, '') });
  return rest ? `${pages}, ${rest}` : pages;
}

const barePage = (part: string) => PAGE.test(part) && !PAGE.exec(part)![3];

/** The AI cites locators like p1-4 and its own IDs; a teacher reads each place in the source on its own. */
export function sourceRefLabels(refs: string[], t: TFunction): string[] {
  const parts = refs.flatMap((ref) => ref.split(/\s+·\s+/)).map((ref) => ref.trim()).filter((ref) => ref && !INTERNAL_ID.test(ref));
  const labels: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const next = parts[i + 1];
    /** "p. 8 · Table 8.1" is one place: the table on page 8. */
    if (barePage(part) && next && !PAGE.test(next) && !LOCATOR.test(next)) {
      labels.push(`${spellOut(part, t)}, ${spellOut(next, t)}`);
      i += 1;
    } else {
      labels.push(spellOut(part, t));
    }
  }
  return [...new Set(labels)];
}

export function readableSourceRefs(refs: string[], t: TFunction): string {
  return sourceRefLabels(refs, t).join('; ');
}
