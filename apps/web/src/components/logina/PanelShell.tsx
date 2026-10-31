import { Link } from '@tanstack/react-router';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';

function HomeLogo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="logo-home" aria-label={t('student.shell.logoHome')}>
      <Logo />
    </Link>
  );
}

/** The left panel layout: a fixed column on a wide screen, a sliding panel behind a menu button on a narrow one. */
export function PanelShell({ phoneTitle, label, panel, children }: { phoneTitle: string | undefined; label: string; panel: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  /** A link in the panel has done its job once followed, so the page shows again. */
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  };

  return (
    <div className="stu-app">
      <header className="stu-phone">
        <HomeLogo />
        <span className="b s13 stu-title">{phoneTitle}</span>
        <MenuButton open={open} onToggle={() => setOpen(!open)} />
      </header>
      {open ? <div className="stu-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <aside className={`stu-side ${open ? 'open' : ''}`} aria-label={label} onClick={closeOnLink}>
        <HomeLogo />
        {panel}
      </aside>
      <div className="stu-col">{children}</div>
    </div>
  );
}
