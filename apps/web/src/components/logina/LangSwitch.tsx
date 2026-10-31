import { useTranslation } from 'react-i18next';
import { switchLanguage, type Lang } from '@/i18n';
import { cn } from '@/lib/utils';

const LANGS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'EN' },
  { lang: 'vi', label: 'VI' },
];

export function LangSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('common.language')} className="inline-flex rounded-md border border-line p-0.5">
      {LANGS.map(({ lang, label }) => {
        const active = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={active}
            onClick={() => void switchLanguage(lang)}
            className={cn('rounded px-2 py-1 text-xs font-semibold', active ? 'bg-navy-bg text-navy' : 'text-ink-3')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
