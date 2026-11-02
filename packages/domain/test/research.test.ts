import { describe, expect, it } from 'vitest';
import { formatChanges } from '../src/research.js';

describe('formatChanges', () => {
  it('lists each change with minutes and seconds, in order', () => {
    expect(formatChanges([{ at: 12, change: 'A' }, { at: 75, change: 'B' }])).toBe('0:12 A; 1:15 B');
  });

  it('gives nothing for no changes', () => {
    expect(formatChanges([])).toBe('');
  });
});
