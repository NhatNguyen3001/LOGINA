import { describe, expect, it } from 'vitest';
import { letterOptionIds } from '../src/option-letters.js';

describe('letterOptionIds', () => {
  it('a prompt names statements and cards by the letters students see', () => {
    expect(letterOptionIds('Statement A1 has two parts. Does the card you chose provide evidence for both?')).toBe('Statement A has two parts. Does the card you chose provide evidence for both?');
    expect(letterOptionIds('Is E4 about shares?')).toBe('Is card D about shares?');
  });

  it('Vietnamese prompts get Vietnamese words', () => {
    expect(letterOptionIds('Câu A1 có hai vế. Thẻ em chọn đã đủ chưa?')).toBe('Câu A có hai vế. Thẻ em chọn đã đủ chưa?');
    expect(letterOptionIds('Em xem lại E2 nhé.')).toBe('Em xem lại thẻ B nhé.');
  });

  it('leaves other codes alone', () => {
    expect(letterOptionIds('Table 8.1 and Q4 and A10')).toBe('Table 8.1 and Q4 and A10');
  });
});
