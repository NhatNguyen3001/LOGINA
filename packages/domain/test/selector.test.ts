import { describe, expect, it } from 'vitest';
import { buildQ1Facts, checkCoverage, selectChallenge } from '../src/selector.js';
import type { LockFacts, RuleBundle, RuleCandidate } from '../src/rules.js';

const candidate = (
  challengeId: string,
  priorityOrder: number,
  all: RuleCandidate['when']['all'],
  targetRef = `ref_${challengeId}`,
): RuleCandidate => ({
  challengeId,
  label: challengeId,
  priorityOrder,
  when: { all },
  requires: { message: true, targetRef },
});

const bundle: RuleBundle = {
  ruleBundleId: 'rb_1',
  slot: 'Q1',
  fallbackChallengeId: 'FB',
  version: 1,
  candidates: [
    candidate('TN3', 2, [{ field: 'evidenceId', op: 'eq', value: 'E3' }]),
    candidate('TN1', 1, [{ field: 'answerId', op: 'in', value: ['A2', 'A3'] }]),
    candidate('TN2', 3, [
      { field: 'answerId', op: 'eq', value: 'A1' },
      { field: 'evidenceId', op: 'eq', value: 'E2' },
    ]),
    candidate('TN4', 4, [{ field: 'evidenceId', op: 'eq', value: 'E4' }]),
  ],
};

const grid: Record<string, string[]> = {
  A1: ['FB', 'TN2', 'TN3', 'TN4'],
  A2: ['TN1', 'TN1', 'TN1', 'TN1'],
  A3: ['TN1', 'TN1', 'TN1', 'TN1'],
  A4: ['FB', 'FB', 'TN3', 'TN4'],
};
const evidenceIds = ['E1', 'E2', 'E3', 'E4'];
const cases = Object.entries(grid).flatMap(([answerId, row]) =>
  row.map((expected, i) => ({ answerId, evidenceId: evidenceIds[i]!, expected })),
);

describe('selectChallenge', () => {
  it.each(cases)('C01 Q1 $answerId + $evidenceId gets $expected', ({ answerId, evidenceId, expected }) => {
    expect(selectChallenge(bundle, { answerId, evidenceId }).challengeId).toBe(expected);
  });

  it('X01 two matches pick lowest priority and record both', () => {
    const result = selectChallenge(bundle, { answerId: 'A2', evidenceId: 'E3' });
    expect(result).toMatchObject({ challengeId: 'TN1', mode: 'NORMAL' });
    expect(result.evaluations.filter((e) => e.matched).map((e) => e.challengeId).sort()).toEqual(['TN1', 'TN3']);
  });

  it('X02 no normal match uses fallback', () => {
    expect(selectChallenge(bundle, { answerId: 'A1', evidenceId: 'E1' })).toMatchObject({
      challengeId: 'FB',
      mode: 'FALLBACK',
    });
  });

  it('candidate missing targetRef is ineligible', () => {
    const broken: RuleBundle = {
      ...bundle,
      candidates: [candidate('TN1', 1, [{ field: 'answerId', op: 'eq', value: 'A2' }], '')],
    };
    expect(selectChallenge(broken, { answerId: 'A2' })).toMatchObject({ challengeId: 'FB', mode: 'FALLBACK' });
  });

  it('a missing fact never matches', () => {
    expect(selectChallenge(bundle, {}).mode).toBe('FALLBACK');
  });

  it('is deterministic', () => {
    const facts: LockFacts = { answerId: 'A4', evidenceId: 'E3' };
    expect(selectChallenge(bundle, facts)).toEqual(selectChallenge(bundle, facts));
  });
});

describe('buildQ1Facts', () => {
  it('looks up the labels and the pair alignment', () => {
    const labels = {
      answers: { A1: 'SUPPORTED_CORRECT' },
      evidence: { E1: 'FULL_SUPPORT' },
      pairs: { A1__E1: 'SUPPORTS_FULL' },
    };
    expect(buildQ1Facts('A1', 'E1', labels)).toEqual({
      answerId: 'A1',
      evidenceId: 'E1',
      answerCorrectness: 'SUPPORTED_CORRECT',
      eQuality: 'FULL_SUPPORT',
      pairAlignment: 'SUPPORTS_FULL',
    });
  });
});

describe('checkCoverage', () => {
  const combos = cases.map(({ answerId, evidenceId }) => ({ answerId, evidenceId }));

  it('checkCoverage reports full coverage for the Q1 bundle', () => {
    expect(checkCoverage(bundle, combos)).toEqual({ ok: true, uncovered: [] });
  });

  it('a bundle with no fallback leaves combos uncovered', () => {
    const result = checkCoverage({ ...bundle, fallbackChallengeId: '' }, combos);
    expect(result.ok).toBe(false);
    expect(result.uncovered).toContainEqual({ answerId: 'A1', evidenceId: 'E1' });
  });
});
