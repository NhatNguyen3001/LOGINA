import { tenPointConfidence } from '@logina/domain';

/** Tabs opened before the switch to 0 to 10 still send confidence out of 100; a whole number from 11 to 100 is read at the same point out of 10. */
export function acceptOldConfidence(raw: unknown, field: 'initialConfidence' | 'finalConfidence'): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const value = (raw as Record<string, unknown>)[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 11 || value > 100) return raw;
  return { ...raw, [field]: tenPointConfidence(value) };
}
