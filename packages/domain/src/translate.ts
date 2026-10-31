import { loadFixture, type FixtureName } from './fixtures.js';

type Locale = 'en' | 'vi';

export interface TextPair {
  from: string;
  to: string;
}

/** Walks two copies of the same content in step. IDs match in both, so only real wording becomes a pair. */
export function textPairs(from: unknown, to: unknown): TextPair[] {
  if (typeof from === 'string' && typeof to === 'string') return from === to ? [] : [{ from, to }];
  if (Array.isArray(from) && Array.isArray(to)) return from.flatMap((item, index) => textPairs(item, to[index]));
  if (from && to && typeof from === 'object' && typeof to === 'object') {
    return Object.keys(from).flatMap((key) => textPairs((from as Record<string, unknown>)[key], (to as Record<string, unknown>)[key]));
  }
  return [];
}

/** Swaps whole strings only, so wording a teacher edited has no pair and stays as written. */
export function applyTexts<T>(value: T, pairs: TextPair[]): T {
  if (pairs.length === 0) return value;
  const lookup = new Map(pairs.map(({ from, to }) => [from, to]));
  const walk = (item: unknown): unknown => {
    if (typeof item === 'string') return lookup.get(item) ?? item;
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([key, field]) => [key, walk(field)]));
    return item;
  };
  return walk(value) as T;
}

const SAMPLE_DRAFTS: FixtureName[] = ['q1-v3', 'q1-v4', 'q2', 'q3', 'q4-v3', 'q4-v4', 'q5'];
const SAMPLE_TITLE = { en: 'Lesson 8: Labor and employment', vi: 'Bài 8: Lao động và việc làm' };
const cached = new Map<string, TextPair[]>();

/** The sample lesson is written in both languages, so its pairs come from its two sets of fixtures. */
export function sampleTexts(from: Locale, to: Locale): TextPair[] {
  const key = `${from}>${to}`;
  const known = cached.get(key);
  if (known) return known;
  const pairs = [
    ...textPairs(SAMPLE_TITLE[from], SAMPLE_TITLE[to]),
    ...SAMPLE_DRAFTS.flatMap((name) => textPairs(loadFixture(name, from), loadFixture(name, to))),
  ];
  cached.set(key, pairs);
  return pairs;
}
