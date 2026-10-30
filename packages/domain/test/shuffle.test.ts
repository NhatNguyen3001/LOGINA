import { describe, expect, it } from 'vitest';
import { applyDisplayOrder, assignRuntimeIds, shuffleForRelease } from '../src/shuffle.js';

const answers = ['A1', 'A2', 'A3', 'A4'].map((answerOptionId) => ({ answerOptionId }));
const evidence = ['E1', 'E2', 'E3', 'E4'].map((generatedEId) => ({ generatedEId }));

describe('shuffleForRelease', () => {
  it('without displayOrder the order is shuffled deterministically from the content hash', () => {
    const items = ['A1', 'A2', 'A3', 'A4'];
    expect(shuffleForRelease('hash', items)).toEqual(shuffleForRelease('hash', items));
    const positions = new Set(
      Array.from({ length: 20 }, (_, i) => shuffleForRelease(`hash${i}`, items).indexOf('A1')),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it('does not change its input and keeps every item', () => {
    const items = ['a', 'b', 'c'];
    expect([...shuffleForRelease('s', items)].sort()).toEqual(['a', 'b', 'c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('applyDisplayOrder', () => {
  const items = ['A1', 'A2', 'A3', 'A4'].map((id) => ({ id }));

  it('displayOrder is applied exactly and must be a permutation', () => {
    expect(applyDisplayOrder(items, ['A2', 'A1', 'A4', 'A3'])?.map((i) => i.id)).toEqual(['A2', 'A1', 'A4', 'A3']);
    expect(() => applyDisplayOrder(items, ['A1', 'A2', 'A3'])).toThrow();
    expect(() => applyDisplayOrder(items, ['A1', 'A2', 'A3', 'A9'])).toThrow();
    expect(() => applyDisplayOrder(items, ['A1', 'A1', 'A2', 'A3'])).toThrow();
  });

  it('is null when displayOrder is absent', () => {
    expect(applyDisplayOrder(items)).toBeNull();
  });
});

describe('assignRuntimeIds', () => {
  const displayOrder = { answers: ['A1', 'A2', 'A3', 'A4'], evidence: ['E1', 'E2', 'E3', 'E4'] };

  it.each([
    ['with', displayOrder],
    ['without', undefined],
  ])('runtime IDs never reveal authoring IDs %s displayOrder', (_, order) => {
    const result = assignRuntimeIds('rel_1', 'hash', answers, evidence, order);
    const ids = [...result.answers.map((a) => a.runtimeId), ...result.evidence.map((e) => e.runtimeId)];
    expect(ids.every((id) => !id.includes('A1') && !id.includes('E1'))).toBe(true);
    expect(result.answers.every((a) => /^opt_[0-9a-f]{10}$/.test(a.runtimeId))).toBe(true);
    expect(result.evidence.every((e) => /^ev_[0-9a-f]{10}$/.test(e.runtimeId))).toBe(true);
  });

  it('displayOrder sets the release order', () => {
    const result = assignRuntimeIds('rel_1', 'hash', answers, evidence, displayOrder);
    expect(result.answers.map((a) => a.answerOptionId)).toEqual(displayOrder.answers);
    expect(result.evidence.map((e) => e.generatedEId)).toEqual(displayOrder.evidence);
  });

  it('runtime IDs differ across releases', () => {
    const one = assignRuntimeIds('rel_1', 'hash', answers, evidence);
    const two = assignRuntimeIds('rel_2', 'hash', answers, evidence);
    expect(one.answers[0]?.runtimeId).not.toBe(two.answers[0]?.runtimeId);
  });
});
