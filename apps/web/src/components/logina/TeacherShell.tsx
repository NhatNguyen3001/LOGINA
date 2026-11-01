import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Layers, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applySessionLocale, setUserLocaleSaver } from '@/i18n';
import { getMe, updateMe } from '@/lib/api';
import { qk, queryClient } from '@/lib/query';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { LegalFooter } from './LegalFooter';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';
import { SwitchSide } from './SwitchSide';
import { Toast } from './Toast';

const SIDEBAR_STORAGE = 'logina.sidebarOpen';

/** Applies the saved language once the session is known, and saves later switches. */
export function useSessionLocale(): void {
  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const uiLocale = me.data?.uiLocale;
  useEffect(() => {
    if (!uiLocale) return;
    void applySessionLocale(uiLocale);
    setUserLocaleSaver(async (lang) => {
      await updateMe({ uiLocale: lang });
      /** Questions and answers come from the server in the saved language. */
      await queryClient.invalidateQueries();
    });
  }, [uiLocale]);
}

export function TeacherShell({ lessonId, assignmentId, children }: { lessonId?: string; assignmentId?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE) !== '0';
    } catch {
      return true;
    }
  });
  useSessionLocale();

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  return (
    <div className={`app min-h-dvh ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
      <aside className="side">
        <div className="side-head">
          <Logo />
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
        <Link to="/t/lessons" className="nav on">
          <Layers aria-hidden="true" />
          <span>{t('teacher.shell.lessons')}</span>
        </Link>
        <MenuButton open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} />
        <div className={`side-more ${menuOpen ? 'open' : ''}`}>
          <div className="me">
            <LangSwitch />
            <SwitchSide to="student" block {...(lessonId ? { lessonId } : {})} />
            <DemoMenu {...(assignmentId ? { assignmentId } : {})} />
          </div>
        </div>
      </aside>
      <div className="app-col">
        {!sidebarOpen ? (
          <div className="shell-topbar teacher-topbar">
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
        <main className="main">{children}</main>
        <LegalFooter />
      </div>
      <BusyNote side="teacher" />
      <Toast />
    </div>
  );
}
