import { useTranslation } from 'react-i18next';

export function Logo() {
  const { t } = useTranslation();
  return (
    <div className="logo">
      <span className="mk">
        <svg viewBox="0 0 76 76" role="img" aria-hidden="true" focusable="false">
          <path d="M9 9V66.5H66" fill="none" stroke="var(--logo-navy)" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M12 63 63 8" fill="none" stroke="var(--logo-teal)" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M71 2 51 9.5 64.5 23z" fill="var(--logo-teal)" stroke="var(--logo-teal)" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="9" cy="9" r="8" fill="var(--logo-navy)" />
          <circle cx="9.5" cy="66.5" r="8.5" fill="var(--logo-navy)" />
          <circle cx="65.5" cy="66.5" r="8" fill="var(--logo-teal)" />
          <circle cx="37.5" cy="37.5" r="13.5" fill="var(--logo-teal)" />
          <circle cx="37.5" cy="37.5" r="10.2" fill="var(--logo-gap)" />
          <circle cx="37.5" cy="37.5" r="7.8" fill="var(--logo-teal)" />
        </svg>
      </span>
      <span className="wm">{t('common.brand')}</span>
    </div>
  );
}
