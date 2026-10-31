import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { applySessionLocale, setUserLocaleSaver } from '@/i18n';
import { getMe, updateMe } from '@/lib/api';
import { qk } from '@/lib/query';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';
import { SwitchSide } from './SwitchSide';

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
  useSessionLocale();

  return (
    <div className="app min-h-dvh">
      <aside className="side">
        <Logo />
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
