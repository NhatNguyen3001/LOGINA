import { Link } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionLocale } from '@/lib/use-session-locale';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { LegalFooter } from './LegalFooter';
import { Logo } from './Logo';
import { PhoneMenu } from './MenuButton';
import { SwitchSide } from './SwitchSide';

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
        <PhoneMenu>
          <LangSwitch />
          <SwitchSide to="student" block {...(lessonId ? { lessonId } : {})} />
          <DemoMenu {...(assignmentId ? { assignmentId } : {})} />
        </PhoneMenu>
      </aside>
      <div className="app-col">
        <main className="main">{children}</main>
        <LegalFooter />
      </div>
      <BusyNote side="teacher" />
    </div>
  );
}
