import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { RESEARCH_COLUMNS } from '@logina/contracts';

export interface SheetClient {
  appendRow: (values: string[]) => Promise<void>;
}

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
};

/**
 * A retry never appends twice: `exportedAt` is checked first. With no Sheet configured the row
 * simply waits in Firestore, and `pnpm research:flush` sends it later.
 */
export async function exportRow(db: Firestore, sheet: SheetClient | null, rowId: string): Promise<void> {
  if (!sheet) return;
  const ref = db.doc(`researchRows/${rowId}`);
  const row = (await ref.get()).data();
  if (!row || row.exportedAt) return;
  await sheet.appendRow(RESEARCH_COLUMNS.map((column) => cell(row[column])));
  await ref.update({ exportedAt: FieldValue.serverTimestamp() });
}

export async function pendingRowIds(db: Firestore): Promise<string[]> {
  const rows = await db.collection('researchRows').where('exportedAt', '==', null).get();
  return rows.docs.map((doc) => doc.id);
}
