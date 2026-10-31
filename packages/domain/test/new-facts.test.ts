import { describe, expect, it } from 'vitest';
import { detectNewFacts } from '../src/new-facts.js';

const evidence = [
  'Tỉ trọng lao động dịch vụ tăng từ 29,5% năm 2010 lên 37,8% năm 2021.',
  'Tổng cục Thống kê công bố số liệu giai đoạn 2010–2021.',
];

describe('detectNewFacts', () => {
  it('X11 adding a percentage is a new fact', () => {
    expect(detectNewFacts('Tỉ trọng lao động dịch vụ giảm 5% trong giai đoạn 2010–2021.', evidence)).toContain('5%');
  });

  it('rewording without new facts passes', () => {
    expect(detectNewFacts('Lao động dịch vụ tăng lên trong giai đoạn 2010–2021.', evidence)).toEqual([]);
  });

  it('years present in evidence are not new', () => {
    expect(detectNewFacts('Năm 2010 và năm 2021 có số liệu.', evidence)).toEqual([]);
  });

  it('a new year is a new fact', () => {
    expect(detectNewFacts('Xu hướng này kéo dài đến năm 2030.', evidence)).toContain('2030');
  });

  it('a percentage matches its bare value in a table marked (%)', () => {
    const table = ['Table 8.1 (%)\nServices | 29.5 | 37.8'];
    expect(detectNewFacts('Services rose from 29.5% to 37.8%.', table)).toEqual([]);
  });

  it('a percentage the table does not hold is still new', () => {
    const table = ['Table 8.1 (%)\nServices | 29.5 | 37.8'];
    expect(detectNewFacts('Services rose to 41.2%.', table)).toEqual(['41.2%']);
  });

  it('a decimal number is one token', () => {
    expect(detectNewFacts('Tăng 2,5 lần.', evidence)).toEqual(['2,5']);
  });

  it('a capitalized multi-word name is a new fact', () => {
    expect(detectNewFacts('Theo Ngân Hàng Thế Giới, lao động tăng.', evidence)).toContain('Ngân Hàng Thế Giới');
  });

  it('a name in the evidence is not new', () => {
    expect(detectNewFacts('Theo Tổng cục Thống kê, lao động tăng.', evidence)).toEqual([]);
  });

  it('the first capitalized word of a sentence alone is not a name', () => {
    expect(detectNewFacts('Lao động tăng.', evidence)).toEqual([]);
  });

  it('NFD and NFC text compare equal', () => {
    expect(detectNewFacts('37,8%'.normalize('NFD'), [evidence[0]!.normalize('NFD')])).toEqual([]);
  });
});
