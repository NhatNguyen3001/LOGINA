import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '@logina/db';
import type { MaterialRefusalDTO } from '@logina/contracts';

export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_PAGES = 10;
export const PDF = 'application/pdf';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type MimeType = typeof PDF | typeof DOCX;

/** A polite refusal: the body is `MaterialRefusalDTO`, not the usual error shape. */
export class MaterialRefusal extends AppError {
  constructor(
    readonly refusal: MaterialRefusalDTO,
    status: 422 | 429 = 422,
  ) {
    super(refusal.code, status, refusal.code);
  }
}

export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export function sniffType(bytes: Buffer): MimeType | null {
  if (bytes.subarray(0, 4).toString('latin1') === '%PDF') return PDF;
  const isZip = bytes.subarray(0, 2).toString('latin1') === 'PK';
  return isZip && bytes.includes('word/document.xml') ? DOCX : null;
}

export async function countPdfPages(bytes: Buffer, fileName: string): Promise<number> {
  try {
    return (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    throw new MaterialRefusal({ code: 'UNREADABLE', detail: { fileName } });
  }
}

/** The pre-Gemini checks at register (live upload design 3.3). Returns what the material version stores. */
export async function inspectUpload(
  bytes: Buffer,
  fileName: string,
): Promise<{ mimeType: MimeType; pageCount: number; unitKind: 'PAGE' | 'SECTION' }> {
  const mimeType = sniffType(bytes);
  if (!mimeType) throw new MaterialRefusal({ code: 'FILE_TYPE', detail: { fileName } });
  if (bytes.length > MAX_BYTES) throw new MaterialRefusal({ code: 'FILE_TOO_LARGE', detail: { fileName } });
  if (mimeType === DOCX) return { mimeType, pageCount: 0, unitKind: 'SECTION' };

  const pageCount = await countPdfPages(bytes, fileName);
  if (pageCount > MAX_PAGES) {
    throw new MaterialRefusal({ code: 'TOO_MANY_PAGES', detail: { fileName, pageCount, limit: MAX_PAGES } });
  }
  return { mimeType, pageCount, unitKind: 'PAGE' };
}
