import { Link } from '@tanstack/react-router';
import { Layers } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionLocale } from '@/lib/use-session-locale';
import { BusyNote } from './BusyNote';
import { DemoMenu } from './DemoMenu';
import { LangSwitch } from './LangSwitch';
import { LegalFooter } from './LegalFooter';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';
import { SwitchSide } from './SwitchSide';
import { Toast } from './Toast';

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
