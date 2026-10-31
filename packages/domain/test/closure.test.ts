import { describe, expect, it } from 'vitest';
import type { Slot } from '@logina/contracts';
import { dependencyClosure } from '../src/closure.js';

const draft = (slot: Slot, refs: Partial<{ claims: string[]; units: string[]; evidence: string[] }>) => ({
  taskDraftId: `tdr_${slot}`,
  slot,
  manifest: {
    sourceClaimIds: refs.claims ?? [],
    sourceUnitIds: refs.units ?? [],
    sourceEvidenceIds: refs.evidence ?? [],
    relationIds: [],
  },
});

describe('dependencyClosure', () => {
  it('VC07 change in unrelated unit leaves task unaffected', () => {
    const result = dependencyClosure(['unit_9'], [draft('Q1', { units: ['unit_1'] })]);
    expect(result).toEqual({ affectedDraftIds: [], unaffectedDraftIds: ['tdr_Q1'] });
  });

  it('VC08 dependent span change marks task affected', () => {
    const result = dependencyClosure(['unit_1'], [draft('Q1', { units: ['unit_1'] })]);
    expect(result).toEqual({ affectedDraftIds: ['tdr_Q1'], unaffectedDraftIds: [] });
  });

  it('QA15 Q1 and Q2 affected, Q3–Q5 unaffected', () => {
    const drafts = [
      draft('Q1', { claims: ['claim_a'] }),
      draft('Q2', { claims: ['claim_a', 'claim_b'] }),
      draft('Q3', { claims: ['claim_b'] }),
      draft('Q4', { evidence: ['ev_1'] }),
      draft('Q5', {}),
    ];
    expect(dependencyClosure(['claim_a'], drafts)).toEqual({
      affectedDraftIds: ['tdr_Q1', 'tdr_Q2'],
      unaffectedDraftIds: ['tdr_Q3', 'tdr_Q4', 'tdr_Q5'],
    });
  });
});
