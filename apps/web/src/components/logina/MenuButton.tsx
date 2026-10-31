import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Only shown on narrow screens, where the header's extra actions fold away. */
export function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const Icon = open ? X : Menu;
  return (
    <button type="button" className="ibtn menu-btn" aria-label={t('common.menu')} aria-expanded={open} onClick={onToggle}>
      <Icon className="ico" aria-hidden="true" />
    </button>
  );
}
