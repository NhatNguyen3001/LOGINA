/** NFC, trimmed, whitespace collapsed to one space (C03). */
export function normalizeText(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}
