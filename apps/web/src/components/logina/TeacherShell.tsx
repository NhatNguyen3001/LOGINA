import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applySessionLocale, setUserLocaleSaver } from '@/i18n';
import { getMe, updateMe } from '@/lib/api';
import { qk } from '@/lib/query';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { LegalFooter } from './LegalFooter';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';
import { SwitchSide } from './SwitchSide';
import { Toast } from './Toast';

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

export function TeacherShell({ lessonId, assignmentId, children }: { lessonId?: string; assignmentId?: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  useSessionLocale();

  return (
    <div className="app min-h-dvh">
      <aside className="side">
        <Logo />
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
        <main className="main">{children}</main>
        <LegalFooter />
      </div>
      <BusyNote side="teacher" />
      <Toast />
    </div>
  );
}
