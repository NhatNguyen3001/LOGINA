import { describe, expect, it } from 'vitest';
import { assignRuntimeIds } from '../src/shuffle.js';
import { aggregateGates, type QualityGate } from '../src/gates.js';
import { checkCoverage, selectChallenge } from '../src/selector.js';
import { loadFixture, type DraftFixture, type FixtureName, type ReportFixture } from '../src/fixtures.js';
import type { LockFacts, RuleBundle } from '../src/rules.js';

const bundle = (name: 'q1' | 'q2' | 'q3' | 'q4' | 'q5', locale: 'en' | 'vi'): RuleBundle => ({
  ruleBundleId: `rb_${name}`,
  ...(loadFixture(`rule-bundles/${name}`, locale) as Omit<RuleBundle, 'ruleBundleId'>),
});

const aggregateOf = (name: FixtureName, locale: 'en' | 'vi') => {
  const report = loadFixture(name, locale) as ReportFixture;
  const gates = report.gates.map(
    (g): QualityGate => ({ ...g, validatorVersion: 'seeded', checkedHash: 'h' }),
  );
  return { computed: aggregateGates(gates, report.deterministic), stored: report.aggregate, report };
};

const q1Combos: LockFacts[] = ['A1', 'A2', 'A3', 'A4'].flatMap((answerId) =>
  ['E1', 'E2', 'E3', 'E4'].map((evidenceId) => ({ answerId, evidenceId })),
);
const q2Combos: LockFacts[] = ['K1', 'K2', 'K3', 'K4'].map((id) => ({ 'q2.firstCardId': id }));
const q3Combos: LockFacts[] = ['O1', 'O2'].flatMap((id) =>
  ['0', '1', '2', '3', '4'].map((count) => ({ 'q3.judgmentOptionId': id, 'q3.tradeOffCount': count })),
);
const q4Combos: LockFacts[] = [
  { 'q4.templateId': 'M1', 'q4.firstChoiceId': 'S1' },
  { 'q4.templateId': 'M1', 'q4.firstChoiceId': 'S2' },
  { 'q4.templateId': 'M2', 'q4.firstChoiceId': 'S3' },
  { 'q4.templateId': 'M2', 'q4.firstChoiceId': 'S4' },
];
const q5Combos: LockFacts[] = ['training', 'business', 'living', 'other'].map((p) => ({ 'q5.keywordPartition': p }));

const allCombos = { q1: q1Combos, q2: q2Combos, q3: q3Combos, q4: q4Combos, q5: q5Combos };
const draftFor = { q1: 'q1-v4', q2: 'q2', q3: 'q3', q4: 'q4-v4', q5: 'q5' } as const;

describe.each(['en', 'vi'] as const)('fixture logic in %s', (locale) => {
  it.each(Object.keys(allCombos) as (keyof typeof allCombos)[])('C01 every rule bundle has full coverage: %s', (name) => {
    expect(checkCoverage(bundle(name, locale), allCombos[name])).toEqual({ ok: true, uncovered: [] });
  });

  it.each(Object.keys(allCombos) as (keyof typeof allCombos)[])('every selected prompt exists in the draft: %s', (name) => {
    const draft = loadFixture(draftFor[name], locale) as DraftFixture;
    const known = draft.challengeCandidates.map((c) => c.challengeId);
    for (const facts of allCombos[name]) {
      expect(known).toContain(selectChallenge(bundle(name, locale), facts).challengeId);
    }
  });

  it('the Q1 pair table matches what the selector picks', () => {
    const draft = loadFixture('q1-v4', locale) as DraftFixture;
    const fallbackLabel = draft.challengeCandidates.find((c) => c.isNeutralFallback)!.label;
    for (const pair of draft.pairAlignments!) {
      const { challengeId } = selectChallenge(bundle('q1', locale), {
        answerId: pair.answerOptionId,
        evidenceId: pair.generatedEId,
      });
      expect(pair.goesToChallengeLabel).toBe(challengeId === 'FB' ? fallbackLabel : challengeId);
    }
  });

  it('stored aggregates match the gates', () => {
    for (const name of ['q1-v3', 'q1-v4', 'q2', 'q3', 'q4-v3', 'q4-v4', 'q5'] as const) {
      const { computed, stored } = aggregateOf(`reports/${name}`, locale);
      expect(computed).toBe(stored);
    }
  });

  it('Q1 v3 aggregates to REVIEW_REQUIRED and v4 to REVIEW_REQUIRED with only QG1 open', () => {
    expect(aggregateOf('reports/q1-v3', locale).computed).toBe('REVIEW_REQUIRED');
    const v4 = aggregateOf('reports/q1-v4', locale);
    expect(v4.computed).toBe('REVIEW_REQUIRED');
    expect(v4.report.gates.filter((g) => g.status !== 'PASS').map((g) => g.gateId)).toEqual(['QG1']);
  });

  it('Q4 v3 aggregates to BLOCKED and v4 to MACHINE_PASS', () => {
    expect(aggregateOf('reports/q4-v3', locale).computed).toBe('BLOCKED');
    expect(aggregateOf('reports/q4-v4', locale).computed).toBe('MACHINE_PASS');
  });

  it('Q1 demo order matches the design letters', () => {
    const draft = loadFixture('q1-v4', locale) as DraftFixture;
    const { answers, evidence } = assignRuntimeIds(
      'rel_1',
      'hash',
      draft.answerOptions!,
      draft.generatedE!,
      draft.displayOrder,
    );
    expect(answers.map((a) => a.answerOptionId)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(evidence.map((e) => e.generatedEId)).toEqual(['E1', 'E2', 'E3', 'E4']);
  });
});
