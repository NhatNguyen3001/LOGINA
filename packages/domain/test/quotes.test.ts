import { describe, expect, it } from 'vitest';
import { checkQuotes } from '../src/quotes.js';
import { toSourceUnits } from '../src/locators.js';

const units = [
  { locator: 'p1-1', text: 'Tỉ trọng tăng  lên 25,3% năm 2021.' },
  { locator: 'p1-2', text: 'Đoạn khác.' },
];

describe('checkQuotes', () => {
  it('keeps a quote found verbatim in the cited unit', () => {
    expect(checkQuotes(units, [{ locator: 'p1-1', quote: '25,3% năm 2021' }]).kept).toHaveLength(1);
  });

  it('keeps a quote that differs only in whitespace or Unicode form', () => {
    expect(checkQuotes(units, [{ locator: 'p1-1', quote: 'Tỉ trọng tăng lên'.normalize('NFD') }]).kept).toHaveLength(1);
  });

  it('drops a quote with a changed number', () => {
    expect(checkQuotes(units, [{ locator: 'p1-1', quote: '25,8%' }]).dropped).toHaveLength(1);
  });

  it('drops a quote that exists only in another unit', () => {
    expect(checkQuotes(units, [{ locator: 'p1-2', quote: '25,3%' }]).dropped).toHaveLength(1);
  });

  it('drops a quote with an unknown locator', () => {
    expect(checkQuotes(units, [{ locator: 'p9-9', quote: '25,3%' }]).dropped).toHaveLength(1);
  });
});

describe('toSourceUnits', () => {
  const reading = {
    pages: [
      {
        n: 2,
        paragraphs: [{ k: 1, text: 'Text' }],
        tables: [{ k: 1, caption: 'Table', dataTable: [['a']] }],
        figures: [{ k: 1, altText: 'A chart' }],
      },
    ],
  };

  it('builds pN-K, tN-K and figN-K locators with readBy AI', () => {
    const result = toSourceUnits('mat', reading);
    expect(result.map((u) => u.id)).toEqual(['p2-1', 't2-1', 'fig2-1']);
    expect(result.every((u) => u.readBy === 'AI')).toBe(true);
  });

  it('figures carry the drafted altText', () => {
    expect(toSourceUnits('mat', reading)[2]?.figure?.altText).toBe('A chart');
  });
});
