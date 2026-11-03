import i18n, { type TFunction } from 'i18next';
import { useSyncExternalStore } from 'react';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

export type Lang = 'en' | 'vi';

type LocaleSaver = (lang: Lang) => Promise<void>;

let saveLocale: LocaleSaver | null = null;

/** The API client registers this once a session exists; without one the choice lives in `?lang=`. */
export function setUserLocaleSaver(saver: LocaleSaver | null): void {
  saveLocale = saver;
}

export const initialLanguage = (search: string): Lang => (new URLSearchParams(search).get('lang') === 'vi' ? 'vi' : 'en');

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, vi: { translation: vi } },
  lng: initialLanguage(globalThis.location?.search ?? ''),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

i18n.on('languageChanged', (lang) => {
  document.documentElement.lang = lang;
});

export const applySessionLocale = (lang: Lang): Promise<TFunction> => i18n.changeLanguage(lang);

let switching: Lang | null = null;
const switchListeners = new Set<() => void>();

function setSwitching(lang: Lang | null): void {
  switching = lang;
  if (lang) document.documentElement.dataset.switching = lang;
  else delete document.documentElement.dataset.switching;
  switchListeners.forEach((listener) => listener());
}

/** The language being switched to, while the server prepares the content in it. */
export const useSwitchingTo = (): Lang | null =>
  useSyncExternalStore(
    (listener) => {
      switchListeners.add(listener);
      return () => switchListeners.delete(listener);
    },
    () => switching,
  );

/**
 * With a session, questions and answers come from the server in the saved language. The words on screen
 * change only once that content is back, so the page never shows half of each language.
 */
export async function switchLanguage(lang: Lang): Promise<void> {
  if (saveLocale) {
    setSwitching(lang);
    try {
      await saveLocale(lang);
    } catch {
      // The words still switch; the content stays in the saved language until the next try.
    } finally {
      await i18n.changeLanguage(lang);
      setSwitching(null);
    }
    return;
  }
  await i18n.changeLanguage(lang);
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.history.replaceState(null, '', url);
}

/** The web never shows the server's message; an unknown code gets the generic text. */
export const errorKey = (code: string): string => (i18n.exists(`errors.${code}`) ? `errors.${code}` : 'errors.generic');

export default i18n;
