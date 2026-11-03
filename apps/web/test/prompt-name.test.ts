import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { promptName } from '@/lib/prompt-name';

describe('prompt names', () => {
  it('a teacher sees a numbered prompt or the neutral prompt, never a rule ID', async () => {
    await i18n.changeLanguage('en');
    expect(promptName('TN3', i18n.t)).toBe('Prompt 3');
    expect(promptName('FB', i18n.t)).toBe('Neutral prompt');
    expect(promptName('Fallback', i18n.t)).toBe('Neutral prompt');
    await i18n.changeLanguage('vi');
    expect(promptName('TN1', i18n.t)).toBe('Gợi ý 1');
    expect(promptName('FB', i18n.t)).toBe('Gợi ý chung');
  });

  it('a label that is not a rule ID shows as it is', async () => {
    await i18n.changeLanguage('en');
    expect(promptName('Custom', i18n.t)).toBe('Custom');
  });
});
