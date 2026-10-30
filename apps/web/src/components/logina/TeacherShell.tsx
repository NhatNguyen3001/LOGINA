import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Layers } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applySessionLocale, setUserLocaleSaver } from '@/i18n';
import { getMe, updateMe } from '@/lib/api';
import { qk } from '@/lib/query';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';
import { SwitchSide } from './SwitchSide';

const COLLAPSED_KEY = 'logina.sidebar';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

/** Applies the saved language once the session is known, and saves later switches. */
export function useSessionLocale(): void {
  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const uiLocale = me.data?.uiLocale;
  useEffect(() => {
    if (!uiLocale) return;
    void applySessionLocale(uiLocale);
    setUserLocaleSaver(async (lang) => {
      await updateMe({ uiLocale: lang });
    });
  }, [uiLocale]);
}

export function LegalLinks() {
  const { t } = useTranslation();
  return (
    <nav className="side-legal" aria-label={t('common.policies')}>
      <Link to="/privacy">{t('teacher.shell.privacy')}</Link>
      <Link to="/terms">{t('teacher.shell.terms')}</Link>
      <Link to="/accessibility">{t('teacher.shell.accessibility')}</Link>
    </nav>
  );
}

export function TeacherShell({ lessonId, assignmentId, children }: { lessonId?: string; assignmentId?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useSessionLocale();

  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1');
    } catch {
      /* The preference just won't persist. */
    }
  };

  return (
    <div className={`app min-h-dvh ${collapsed ? 'side-collapsed' : ''}`}>
      <aside className="side">
        <div className="row">
          <Logo />
          <button type="button" className="collapse-btn" aria-label={t('teacher.shell.collapse')} onClick={toggle}>
            <ChevronLeft aria-hidden="true" />
          </button>
        </div>
        <Link to="/t/lessons" className="nav on">
          <Layers aria-hidden="true" />
          <span>{t('teacher.shell.lessons')}</span>
        </Link>
        <div className="me">
          <LangSwitch />
          <SwitchSide to="student" block {...(lessonId ? { lessonId } : {})} />
          <DemoMenu {...(assignmentId ? { assignmentId } : {})} />
        </div>
        <LegalLinks />
      </aside>
      <main className="main">{children}</main>
      <BusyNote side="teacher" />
    </div>
  );
}
