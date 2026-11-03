import { Menu, X } from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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

const NARROW = '(max-width: 860px)';
const subscribeNarrow = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isNarrow = () => typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;

/** On a laptop the actions sit in the sidebar; on a phone they open in a panel from the top that closes on Escape and gives focus back. */
export function PhoneMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const [open, setOpen] = useState(false);
  if (!narrow) return <div className="side-more"><div className="me">{children}</div></div>;
  return (
    // Closed, the panel stays mounted and is not modal, so the demo tour inside it can run as before.
    <Sheet open={open} onOpenChange={setOpen} modal={open}>
      <SheetTrigger asChild>
        <button type="button" className="ibtn menu-btn" aria-label={t('common.menu')}>
          <Menu className="ico" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="top" closeLabel={t('demo.close')} keepMounted aria-describedby={undefined}>
        <SheetTitle>{t('common.menu')}</SheetTitle>
        <div className="me">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
