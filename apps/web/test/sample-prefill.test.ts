import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_PREFILL, samplePrefill } from '@/lib/sample-prefill';

vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(), idToken: vi.fn(), renewSession: vi.fn() }));

const fixture = (locale: 'en' | 'vi', name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), '../../packages/domain/fixtures/dia-ly-12-bai-8', locale, `${name}.json`), 'utf8'));

describe('sample pre-fill', () => {
  it.each(['en', 'vi'] as const)('matches the sample fixtures in %s, so the scripted edits pass their checks', (locale) => {
    const prefill = SAMPLE_PREFILL[locale];
    const source = fixture(locale, 'source');
    const edits = fixture(locale, 'scripted-edits') as { payload: Record<string, string> }[];
    expect(prefill.lesson.sourceTitle).toBe(source.material.title);
    expect(prefill.lesson.objective).toBe(source.intent.objective);
    expect(prefill.optionText).toEqual({ A4: edits.find((e) => e.payload.optionId === 'A4')!.payload.text });
    expect(prefill.promptText).toEqual({ TN2: edits.find((e) => e.payload.challengeId === 'TN2')!.payload.message });
    const issues = fixture(locale, 'issues') as { id: string; suggestions: { id: string }[] }[];
    for (const [issueId, answer] of Object.entries(prefill.issues)) {
      const issue = issues.find((i) => i.id === issueId)!;
      if (answer.suggestionId) expect(issue.suggestions.map((s) => s.id)).toContain(answer.suggestionId);
    }
  });

  it('applies only to a lesson on the sample material, in its content language', () => {
    expect(samplePrefill({ aiMode: 'SEEDED', contentLocale: 'vi' })).toBe(SAMPLE_PREFILL.vi);
    expect(samplePrefill({ aiMode: 'LIVE', contentLocale: 'en' })).toBeNull();
    expect(samplePrefill(undefined)).toBeNull();
  });
});
