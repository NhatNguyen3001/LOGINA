import { describe, expect, it } from 'vitest';
import { normalizeText } from '../src/normalize.js';

describe('normalizeText', () => {
  it('C03 trims and collapses spaces', () => {
    expect(normalizeText('  Tăng   việc làm \n')).toBe('Tăng việc làm');
  });

  it('normalizeText equates NFD and NFC Vietnamese', () => {
    expect(normalizeText('thu\u0309y sa\u0309n')).toBe(normalizeText('thủy sản'));
  });
});
