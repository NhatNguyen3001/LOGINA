import { useTranslation } from 'react-i18next';
import { switchLanguage, useSwitchState, type Lang } from '@/i18n';

/** Each language is written in itself, so someone on the other language's screen can still find theirs. */
const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'vi', label: 'Tiếng Việt' },
];

/** While a switch loads, the buttons ignore clicks but keep focus, so a keyboard user is not sent back to the top. */
export function LangSwitch() {
  const { t, i18n } = useTranslation();
  const { to: switchingTo, failed } = useSwitchState();
  return (
    <>
      <div role="group" aria-label={t('common.language')} className="lang-switch">
        {LANGS.map(({ lang, label }) => (
          <button
            key={lang}
            type="button"
            lang={lang}
            aria-pressed={(switchingTo ?? i18n.language) === lang}
            aria-busy={switchingTo === lang}
            aria-disabled={switchingTo !== null}
            onClick={() => {
              if (switchingTo === null) void switchLanguage(lang);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {failed ? <p role="alert" className="lang-failed">{t('common.langFailed')}</p> : null}
    </>
  );
}
