import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { MaterialRefusal } from './materials.js';

/** The Asia/Ho_Chi_Minh calendar day, as `yyyy-mm-dd`. */
export const usageDay = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);

/** Runs inside the register transaction, so two uploads at the cap can't both pass. */
export async function incrementLiveUsage(
  db: Firestore,
  tx: Transaction,
  now: Date,
  cap: number,
  fileName: string,
): Promise<void> {
  const ref = db.doc(`demoMeta/liveUsage_${usageDay(now)}`);
  const count = ((await tx.get(ref)).data()?.count as number | undefined) ?? 0;
  if (count >= cap) throw new MaterialRefusal({ code: 'DAILY_LIMIT', detail: { fileName, limit: cap } }, 429);
  tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
