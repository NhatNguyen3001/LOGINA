import { describe, expect, it } from 'vitest';
import { applyTexts, loadFixture, sampleTexts, studentTexts, textPairs, type DraftFixture } from '../src/index.js';

describe('text pairs', () => {
  it('pairs the strings of two copies of the same content, in step', () => {
    const pairs = textPairs({ stem: 'Hello', cards: [{ id: 'K1', text: 'One' }] }, { stem: 'Xin chào', cards: [{ id: 'K1', text: 'Một' }] });
    expect(pairs).toEqual([{ from: 'Hello', to: 'Xin chào' }, { from: 'One', to: 'Một' }]);
  });

  it('swaps whole strings anywhere in a value and leaves the rest alone', () => {
    const pairs = [{ from: 'One', to: 'Một' }];
    expect(applyTexts({ id: 'K1', text: 'One', more: ['One', 'A teacher edit', 3] }, pairs)).toEqual({ id: 'K1', text: 'Một', more: ['Một', 'A teacher edit', 3] });
  });

  it('with no pairs, returns the same value', () => {
    const value = { text: 'One' };
    expect(applyTexts(value, [])).toBe(value);
  });
});

describe('studentTexts', () => {
  const q5 = loadFixture('q5', 'en') as DraftFixture;

  it('lists what a student reads, with no IDs and no scoring data', () => {
    const texts = studentTexts(q5);
    expect(texts).toContain(q5.questionStem);
    expect(texts).toContain((q5.taskBody as { instructions: string }).instructions);
    expect(texts).toContain(q5.challengeCandidates[0]!.message);
    expect(texts).not.toContain('training');
    expect(texts).not.toContain(q5.challengeCandidates[0]!.challengeId);
  });

  it('includes the feedback labels a student reads on the results page', () => {
    expect(studentTexts(q5)).toContain(q5.feedback[0]!.relationLabel);
  });

  it('lists a repeated string once', () => {
    const repeated = { ...q5, questionStem: q5.challengeCandidates[0]!.message };
    const texts = studentTexts(repeated);
    expect(texts.filter((text) => text === repeated.questionStem)).toHaveLength(1);
  });
});

describe('sampleTexts', () => {
  const swap = (text: string) => applyTexts(text, sampleTexts('en', 'vi'));

  it('covers every Q1 and Q5 string a student reads, in the other language', () => {
    const en = loadFixture('q1-v4', 'en') as DraftFixture;
    const vi = loadFixture('q1-v4', 'vi') as DraftFixture;
    expect(swap(en.questionStem)).toBe(vi.questionStem);
    expect(swap(en.answerOptions![0]!.text)).toBe(vi.answerOptions![0]!.text);
    expect(swap(en.generatedE![0]!.text)).toBe(vi.generatedE![0]!.text);
    expect(swap(en.challengeCandidates[0]!.message)).toBe(vi.challengeCandidates[0]!.message);
    const q5 = loadFixture('q5', 'en') as DraftFixture;
    expect(swap(q5.questionStem)).toBe((loadFixture('q5', 'vi') as DraftFixture).questionStem);
  });

  it('translates the sample lesson title', () => {
    expect(swap('Lesson 8: Labor and employment')).toBe('Bài 8: Lao động và việc làm');
  });

  it('works in the other direction too', () => {
    expect(applyTexts('Bài 8: Lao động và việc làm', sampleTexts('vi', 'en'))).toBe('Lesson 8: Labor and employment');
  });
});
