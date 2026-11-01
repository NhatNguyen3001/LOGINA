import { Link } from '@tanstack/react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';

const SIDEBAR_STORAGE = 'logina.sidebarOpen';

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE) !== '0';
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

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
    <div className={`stu-app ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <header className="stu-phone">
        <HomeLogo />
        <span className="b s13 stu-title">{phoneTitle}</span>
        <MenuButton open={open} onToggle={() => setOpen(!open)} />
      </header>
      {open ? <div className="stu-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <aside className={`stu-side ${open ? 'open' : ''}`} aria-label={label} onClick={closeOnLink}>
        <div className="side-head">
          <HomeLogo />
          <button
            type="button"
            className="ibtn sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={t('common.hideToolbar')}
            aria-label={t('common.hideToolbar')}
          >
            <PanelLeftClose className="ico" aria-hidden="true" />
          </button>
        </div>
        {panel}
      </aside>
      <div className="stu-col">
        {!sidebarOpen ? (
          <div className="shell-topbar student-topbar">
            <button
              type="button"
              className="sidebar-toggle-open"
              onClick={toggleSidebar}
              title={t('common.showToolbar')}
              aria-label={t('common.showToolbar')}
            >
              <PanelLeftOpen className="ico" aria-hidden="true" />
              <span>{t('common.showToolbar')}</span>
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
