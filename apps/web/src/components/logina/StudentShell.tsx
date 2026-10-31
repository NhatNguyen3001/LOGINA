import type { ReactNode } from 'react';
import { LangSwitch } from './LangSwitch';
import { Link } from '@tanstack/react-router';
import { House } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LegalFooter } from './LegalFooter';

interface StudentShellProps {
  title: string;
  progress?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function HomeLink() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="btn secondary sm">
      <House className="ico" aria-hidden="true" />
      {t('student.shell.home')}
    </Link>
  );
}

export function StudentShell({ title, progress, actions, footer, children }: StudentShellProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="stu-top">
        <div className="stu-in">
          <div className="row">
            <HomeLink />
            <span className="b s15">{title}</span>
            <span className="sp" />
            <Link to="/s/assignments" className="btn secondary sm">{t('student.shell.runs')}</Link>
            <LangSwitch />
            {actions}
          </div>
          {progress}
        </div>
      </header>
      <main className="stu-in stu-body w-full grow">{children}</main>
      {footer ? (
        <footer className="stu-foot">
          <div className="stu-in row">{footer}</div>
        </footer>
      ) : null}
      <LegalFooter />
    </div>
  );
}
