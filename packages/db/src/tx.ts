import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: HttpStatus,
    message: string,
    readonly affectedRefs?: string[],
  ) {
    super(message);
  }
}

/** Released, approved, locked and delivered documents never change: a second write fails the transaction. */
export function writeOnce(tx: Transaction, ref: DocumentReference, data: object): void {
  tx.create(ref, data);
}

/** Optimistic concurrency (R06). Reads, so it must run before the transaction's writes. */
export async function bumpVersion(tx: Transaction, ref: DocumentReference, expected: number): Promise<number> {
  const snapshot = await tx.get(ref);
  const current = snapshot.data()?.version as number | undefined;
  if (current !== expected) throw new AppError('VERSION_CONFLICT', 409, 'A newer version exists.');
  tx.update(ref, { version: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
  return expected + 1;
}
