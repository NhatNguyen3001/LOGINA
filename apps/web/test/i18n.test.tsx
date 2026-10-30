import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTranslation } from 'react-i18next';
import { afterEach, describe, expect, it, vi as vitest } from 'vitest';
import { LangSwitch } from '@/components/logina/LangSwitch';
import { applySessionLocale, errorKey, initialLanguage, setUserLocaleSaver } from '@/i18n';
import en from '@/locales/en.json';
import vi from '@/locales/vi.json';
import { renderWithI18n } from './utils';

const REFUSALS = ['FILE_TYPE', 'FILE_TOO_LARGE', 'TOO_MANY_PAGES', 'DAILY_LIMIT', 'UNREADABLE', 'UNSUPPORTED_LANGUAGE', 'TOO_LITTLE_CONTENT'];

const keysOf = (tree: object, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => (typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value as object, `${prefix}${key}.`)));

function Label() {
  const { t } = useTranslation();
  return <p>{t('teacher.t05.readByAi')}</p>;
}

afterEach(() => setUserLocaleSaver(null));

describe('language', () => {
  it('renderWithI18n renders English by default and Vietnamese with lang vi', async () => {
    const { unmount } = await renderWithI18n(<Label />);
    expect(screen.getByText('Read by AI')).toBeInTheDocument();
    unmount();
    await renderWithI18n(<Label />, { lang: 'vi' });
    expect(screen.getByText('Đọc bằng AI')).toBeInTheDocument();
  });

  it('defaults to English and reads ?lang=vi before the session is ready', () => {
    expect(initialLanguage('')).toBe('en');
    expect(initialLanguage('?lang=vi')).toBe('vi');
    expect(initialLanguage('?lang=fr')).toBe('en');
  });

  it('the session language wins, and html lang follows it', async () => {
    await renderWithI18n(<Label />);
    await applySessionLocale('vi');
    expect(await screen.findByText('Đọc bằng AI')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('vi');
  });

  it('switching with a session saves uiLocale', async () => {
    const saver = vitest.fn(async () => {});
    setUserLocaleSaver(saver);
    await renderWithI18n(<LangSwitch />);
    await userEvent.click(screen.getByRole('button', { name: 'VI' }));
    expect(saver).toHaveBeenCalledWith('vi');
    expect(screen.getByRole('button', { name: 'VI' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching without a session updates ?lang=', async () => {
    await renderWithI18n(<LangSwitch />);
    await userEvent.click(screen.getByRole('button', { name: 'VI' }));
    expect(window.location.search).toBe('?lang=vi');
    window.history.replaceState(null, '', '/');
  });
});

describe('locale files', () => {
  it('en.json and vi.json have the same keys', () => {
    expect(keysOf(vi).sort()).toEqual(keysOf(en).sort());
  });

  it('no string in either locale contains an em-dash', () => {
    expect(JSON.stringify(en) + JSON.stringify(vi)).not.toContain('—');
  });

  it('API error codes map to messages in both languages', () => {
    const messages = keysOf(en.errors);
    for (const code of [...REFUSALS, 'VERSION_CONFLICT', 'BLOCKERS_REMAIN']) {
      expect(messages).toContain(code);
      expect(errorKey(code)).toBe(`errors.${code}`);
    }
    expect(errorKey('LIVE_DISABLED')).toBe('errors.generic');
    expect(errorKey('anything else')).toBe('errors.generic');
  });
});
