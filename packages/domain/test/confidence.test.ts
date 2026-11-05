import { describe, expect, it } from 'vitest';
import { tenPointConfidence } from '../src/confidence.js';

describe('tenPointConfidence', () => {
  it('leaves a value on the 0 to 10 scale as it is', () => {
    for (const value of [0, 5, 10]) expect(tenPointConfidence(value)).toBe(value);
  });

  it('reads a value saved out of 100 at the same point out of 10', () => {
    expect(tenPointConfidence(70)).toBe(7);
    expect(tenPointConfidence(55)).toBe(6);
    expect(tenPointConfidence(100)).toBe(10);
  });
});
