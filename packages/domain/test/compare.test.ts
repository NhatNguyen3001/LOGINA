import { describe, expect, it } from 'vitest';
import type { Artifact } from '@logina/contracts';
import { compareArtifacts } from '../src/compare.js';

const q1 = (answerId: string, evidenceId: string): Artifact => ({ slot: 'Q1', answerId, evidenceId });

describe('compareArtifacts', () => {
  it('S03 Q1 changing only evidence is REVISE', () => {
    expect(compareArtifacts(q1('a', 'e1'), q1('a', 'e2'))).toEqual({
      revised: true,
      changedElements: ['evidence'],
    });
  });

  it('S01 Q1 changing answer and evidence is one REVISE', () => {
    expect(compareArtifacts(q1('a', 'e1'), q1('b', 'e2'))).toEqual({
      revised: true,
      changedElements: ['answer', 'evidence'],
    });
  });

  it('S02 identical Q1 is KEEP', () => {
    expect(compareArtifacts(q1('a', 'e1'), q1('a', 'e1'))).toEqual({
      revised: false,
      changedElements: [],
    });
  });

  it('Q2 reordering is REVISE', () => {
    const before: Artifact = { slot: 'Q2', orderedCardIds: ['c1', 'c2'] };
    const after: Artifact = { slot: 'Q2', orderedCardIds: ['c2', 'c1'] };
    expect(compareArtifacts(before, after)).toEqual({ revised: true, changedElements: ['order'] });
  });

  const q3 = (judgmentOptionId: string, tradeOffId: string, reasonId: string): Artifact => ({ slot: 'Q3', judgmentOptionId, tradeOffId, reasonId });

  it('Q3 with the same path, cost and reason is unchanged', () => {
    expect(compareArtifacts(q3('o1', 't1', 'r1'), q3('o1', 't1', 'r1'))).toEqual({ revised: false, changedElements: [] });
  });

  it('Q3 reports each changed element', () => {
    expect(compareArtifacts(q3('o1', 't1', 'r1'), q3('o2', 't2', 'r2')).changedElements).toEqual(['judgment', 'tradeOff', 'reason']);
  });

  const q4 = (...placements: [string, string][]): Artifact => ({ slot: 'Q4', placements: placements.map(([slotId, cardId]) => ({ slotId, cardId })) });

  it('Q4 ignores the order placements arrive in', () => {
    expect(compareArtifacts(q4(['s1', 'a'], ['s2', 'b']), q4(['s2', 'b'], ['s1', 'a'])).revised).toBe(false);
  });

  it('Q4 counts a different card in a blank', () => {
    expect(compareArtifacts(q4(['s1', 'a']), q4(['s1', 'b']))).toEqual({ revised: true, changedElements: ['placements'] });
  });

  const q5 = (...answers: string[]): Artifact => ({ slot: 'Q5', answers: answers.map((text, index) => ({ starterId: `s${index + 1}`, text })) });

  it('Q5 whitespace-only change is KEEP', () => {
    expect(compareArtifacts(q5('Vì  lao động'), q5(' Vì lao động ')).revised).toBe(false);
  });

  it('Q5 NFD and NFC forms are KEEP', () => {
    expect(compareArtifacts(q5('thu\u0309y sa\u0309n'), q5('thủy sản')).revised).toBe(false);
  });

  it('Q5 changing a sentence is REVISE', () => {
    expect(compareArtifacts(q5('a', 'b'), q5('a', 'c')).changedElements).toEqual(['answers']);
  });

  it('Q5 replacing an answer with a button is REVISE', () => {
    const marked: Artifact = { slot: 'Q5', answers: [{ starterId: 's1', text: 'a', declared: 'DONT_KNOW' }] };
    expect(compareArtifacts(q5('a'), marked).revised).toBe(true);
  });

  it('artifacts from different slots throw', () => {
    expect(() => compareArtifacts(q1('a', 'e'), q5('p'))).toThrow();
  });
});
