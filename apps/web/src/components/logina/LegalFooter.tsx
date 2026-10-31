import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export function LegalFooter() {
  const { t } = useTranslation();
  return (
    <footer className="legal-foot">
      <Link to="/privacy">{t('teacher.shell.privacy')}</Link>
      <Link to="/terms">{t('teacher.shell.terms')}</Link>
      <Link to="/accessibility">{t('teacher.shell.accessibility')}</Link>
    </footer>
  );
}
