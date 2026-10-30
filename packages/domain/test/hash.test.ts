import { describe, expect, it } from 'vitest';
import { canonicalHash } from '../src/hash.js';

describe('canonicalHash', () => {
  it('is independent of key order', () => {
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
  });

  it('differs when a value changes', () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
  });

  it('is SHA-256 hex', () => {
    expect(canonicalHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
