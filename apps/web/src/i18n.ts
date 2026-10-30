import i18n, { type TFunction } from 'i18next';
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

export async function switchLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  if (saveLocale) {
    await saveLocale(lang);
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  window.history.replaceState(null, '', url);
}

/** The web never shows the server's message; an unknown code gets the generic text. */
export const errorKey = (code: string): string => (i18n.exists(`errors.${code}`) ? `errors.${code}` : 'errors.generic');

export default i18n;
