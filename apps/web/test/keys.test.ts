import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en.json';
import vi from '@/locales/vi.json';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
});

const source = walk(resolve(process.cwd(), 'src')).map((path) => readFileSync(path, 'utf8')).join('\n');

const has = (tree: unknown, key: string): boolean => typeof key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree) === 'string';

describe('translation keys', () => {
  it('every literal key used in the code exists in both languages', () => {
    const keys = [...new Set([...source.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((match) => match[1]!))];
    expect(keys.length).toBeGreaterThan(200);
    expect(keys.filter((key) => !has(en, key) || !has(vi, key))).toEqual([]);
  });

  it('every key built from a value has all its values', () => {
    const families: Record<string, string[]> = {
      'teacher.status': ['NONE', 'GENERATING', 'VALIDATING', 'BLOCKED', 'REVIEW_REQUIRED', 'MACHINE_PASS', 'STALE', 'FAILED', 'APPROVED', 'SUPERSEDED'],
      'teacher.gate': ['PASS', 'REVIEW_REQUIRED', 'BLOCKER'],
      'teacher.t05.claimStatus': ['VERIFIED', 'CONTEXT_ONLY', 'INSUFFICIENT', 'EXCLUDED'],
      'teacher.t03.severity': ['BLOCKER', 'REVIEW'],
      'teacher.t06.sufficiency': ['SUFFICIENT', 'UNCERTAIN', 'INSUFFICIENT'],
      'lessons.stage': ['CREATE', 'CLARIFY', 'SOURCE_REVIEW', 'GENERATE_PREVIEW', 'APPROVE_ASSIGN', 'ASSIGNED'],
      'student.status': ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'],
      'teacher.taskType': ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
      'student.progress': ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
    };
    const missing = Object.entries(families).flatMap(([family, values]) => values.map((value) => `${family}.${value}`)).filter((key) => !has(en, key) || !has(vi, key));
    expect(missing).toEqual([]);
  });

  it('every job failure code has a message', () => {
    for (const code of ['TOO_MANY_PAGES', 'UNREADABLE', 'UNSUPPORTED_LANGUAGE', 'TOO_LITTLE_CONTENT']) expect(has(en, `errors.${code}`)).toBe(true);
  });
});
