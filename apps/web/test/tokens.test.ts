import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), '../../packages/ui/tokens.css'), 'utf8');
const [lightBlock = '', darkBlock = ''] = css.split('@media (prefers-color-scheme: dark)');

const token = (block: string, name: string): string => {
  const value = new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`).exec(block)?.[1];
  if (!value) throw new Error(`No token ${name}`);
  return value;
};

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('design tokens', () => {
  it('holds the gallery values', () => {
    expect(token(lightBlock, 'ink-3')).toBe('#5B6472');
    expect(token(lightBlock, 'control')).toBe('#848D9C');
    expect(token(darkBlock, 'ink-3')).toBe('#96A0AF');
  });

  it.each([
    ['light', lightBlock],
    ['dark', darkBlock],
  ])('%s theme meets the contrast floors', (_, block) => {
    expect(contrast(token(block, 'ink-3'), token(block, 'gray'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(block, 'control'), token(block, 'surface'))).toBeGreaterThanOrEqual(3);
  });
});
