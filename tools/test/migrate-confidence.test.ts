import { describe, expect, it } from 'vitest';
import { convertTask } from '../migrate-confidence.js';

const CUTOVER = Date.parse('2026-11-04T11:48:38Z');
const at = (iso: string) => ({ toMillis: () => Date.parse(iso) });
const before = at('2026-11-04T10:00:00Z');
const after = at('2026-11-05T03:00:00Z');

describe('convertTask', () => {
  it('converts a task locked and submitted before the switch, including small values', () => {
    expect(convertTask({ lockedAt: before, submittedAt: before, initialConfidence: 70, finalConfidence: 8, confidenceDelta: -62 }, CUTOVER)).toEqual({ initialConfidence: 7, finalConfidence: 1, confidenceDelta: -6, confidenceScale: 10 });
  });

  it('converts only the first answer when the final one came after the switch', () => {
    expect(convertTask({ lockedAt: before, submittedAt: after, initialConfidence: 50, finalConfidence: 6, confidenceDelta: -44 }, CUTOVER)).toEqual({ initialConfidence: 5, confidenceDelta: 1, confidenceScale: 10 });
  });

  it('leaves a locked task with no final answer yet without a delta', () => {
    expect(convertTask({ lockedAt: before, initialConfidence: 55 }, CUTOVER)).toEqual({ initialConfidence: 6, confidenceScale: 10 });
  });

  it('leaves tasks from after the switch, unlocked tasks and converted tasks alone', () => {
    expect(convertTask({ lockedAt: after, submittedAt: after, initialConfidence: 7, finalConfidence: 8 }, CUTOVER)).toBeNull();
    expect(convertTask({ draftArtifact: { slot: 'Q1' } }, CUTOVER)).toBeNull();
    expect(convertTask({ lockedAt: before, initialConfidence: 7, confidenceScale: 10 }, CUTOVER)).toBeNull();
  });
});
