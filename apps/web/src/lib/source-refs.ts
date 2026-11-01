import type { TFunction } from 'i18next';

const LOCATOR = /^([ptf])(\d+)-(\d+)$/;
const INTERNAL_ID = /^[a-z]+\d*_\w+$/i;
const KIND: Record<string, string> = { p: 'para', t: 'table', f: 'figure' };

/** The AI cites locators like p1-4 and its own IDs; a teacher reads pages and paragraphs. */
export function readableSourceRefs(refs: string[], t: TFunction): string {
  const parts = refs.flatMap((ref) => ref.split(' · ')).map((ref) => ref.trim());
  const labels = parts
    .filter((ref) => ref && !INTERNAL_ID.test(ref))
    .map((ref) => {
      const match = LOCATOR.exec(ref);
      return match ? t(`teacher.sourceRef.${KIND[match[1]!]}`, { page: match[2], n: match[3] }) : ref;
    });
  return [...new Set(labels)].join(' · ');
}
