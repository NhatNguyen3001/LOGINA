import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIXTURE_NAMES, FIXTURE_SCHEMAS, loadFixture, fixtureDir, type DraftFixture } from '../src/fixtures.js';

const LOCALES = ['en', 'vi'] as const;

/** Every string that is an ID or code stays; prose is blanked, so en and vi can be compared by structure. */
const structure = (value: unknown, key = ''): unknown => {
  if (Array.isArray(value)) return value.map((item) => structure(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, structure(v, k)]));
  }
  if (key === 'end') return 0;
  const isProse = /^(locator|sourceRef|sourceRefs|sourceAnchor)$/.test(key);
  const isId = !isProse && /(Id|Ids|Refs|id|Fixture|field|op|slot|status|mode|choice|version)$/.test(key);
  return typeof value === 'string' && !isId ? '' : value;
};

const materialLocators = (locale: 'en' | 'vi'): Set<string> => {
  const path = fileURLToPath(new URL(`${fixtureDir(locale)}/material.md`, import.meta.url));
  const markers = readFileSync(path, 'utf8').matchAll(/\{\{(?:para (p\d+-\d+)|(table [\d.]+)|(secondary))\}\}/g);
  return new Set([...markers].map((m) => m[1] ?? m[2] ?? m[3]!));
};

describe.each(LOCALES)('fixtures in %s', (locale) => {
  it.each(FIXTURE_NAMES)('every fixture parses with its schema: %s', (name) => {
    expect(() => FIXTURE_SCHEMAS[name].parse(loadFixture(name, locale))).not.toThrow();
  });

  it('M08 no Generated E text appears in source.json', () => {
    const source = JSON.stringify(loadFixture('source', locale));
    const q1 = loadFixture('q1-v3', locale) as DraftFixture;
    for (const card of q1.generatedE!) expect(source).not.toContain(card.text);
  });

  it('no fixture text contains an em-dash', () => {
    for (const name of FIXTURE_NAMES) expect(JSON.stringify(loadFixture(name, locale))).not.toContain('—');
  });

  it('material.md paragraph locators match source.json', () => {
    const known = materialLocators(locale);
    const source = loadFixture('source', locale) as { units: { id: string }[] };
    expect(source.units.length).toBeGreaterThan(0);
    for (const unit of source.units) expect(known).toContain(unit.id);
  });

  it('scripted-edits has q4-tn2-fix and its message drops the leaking phrase', () => {
    const edits = loadFixture('scripted-edits', locale) as { id: string; payload: { message?: string } }[];
    const fix = edits.find((edit) => edit.id === 'q4-tn2-fix');
    expect(fix?.payload.message).toBeTruthy();
    expect(fix?.payload.message).not.toMatch(/labor productivity rose|năng suất lao động tăng/);
    const leaking = (loadFixture('q4-v3', locale) as DraftFixture).challengeCandidates.find((c) => c.challengeId === 'TN2');
    expect(leaking?.message).toMatch(/labor productivity rose|năng suất lao động tăng/);
  });

  it('draft versions at approval are Q1 v4, Q2 v2, Q3 v2, Q4 v4, Q5 v3', () => {
    const versions = (['q1-v4', 'q2', 'q3', 'q4-v4', 'q5'] as const).map(
      (name) => (loadFixture(name, locale) as DraftFixture).draftVersion,
    );
    expect(versions).toEqual([4, 2, 2, 4, 3]);
  });

  it('Q1 has 16 pairs, 4 statements, 4 cards, 4 prompts and one fallback', () => {
    for (const name of ['q1-v3', 'q1-v4'] as const) {
      const draft = loadFixture(name, locale) as DraftFixture;
      expect(draft.pairAlignments).toHaveLength(16);
      expect(draft.answerOptions).toHaveLength(4);
      expect(draft.generatedE).toHaveLength(4);
      expect(draft.challengeCandidates).toHaveLength(5);
      expect(draft.challengeCandidates.filter((c) => c.isNeutralFallback)).toHaveLength(1);
    }
  });
});

describe('en and vi', () => {
  it.each(FIXTURE_NAMES)('en and vi fixtures have identical IDs and structure: %s', (name) => {
    expect(structure(loadFixture(name, 'vi'))).toEqual(structure(loadFixture(name, 'en')));
  });
});
