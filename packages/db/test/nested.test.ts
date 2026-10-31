import { describe, expect, it } from 'vitest';
import { decodeNested, encodeNested } from '../src/nested.js';

describe('encodeNested', () => {
  const value = { rows: [['a', 'b'], ['c']], plain: ['x'], deep: { orders: [[['y']]] }, n: 1 };

  it('leaves no array directly inside an array', () => {
    const encoded = JSON.stringify(encodeNested(value));
    expect(encoded).not.toContain('[[');
    expect(encodeNested(value).plain).toEqual(['x']);
  });

  it('round-trips', () => {
    expect(decodeNested(encodeNested(value))).toEqual(value);
  });

  it('keeps Date and other class instances', () => {
    const at = new Date(0);
    expect(encodeNested({ at }).at).toBe(at);
  });
});
