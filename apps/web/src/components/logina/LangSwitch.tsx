import { useTranslation } from 'react-i18next';
import { switchLanguage, type Lang } from '@/i18n';

/** Each language is written in itself, so someone on the other language's screen can still find theirs. */
const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'vi', label: 'Tiếng Việt' },
];

export function LangSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('common.language')} className="lang-switch">
      {LANGS.map(({ lang, label }) => (
        <button key={lang} type="button" lang={lang} aria-pressed={i18n.language === lang} onClick={() => void switchLanguage(lang)}>
          {label}
        </button>
      ))}
    </div>
  );
}
