import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitch } from './LangSwitch';
import { LegalFooter } from './LegalFooter';
import { PanelShell } from './PanelShell';
import { SwitchSide } from './SwitchSide';

interface StudentShellProps {
  /** The page's own heading. A task has none here: its question is the heading. */
  title?: string;
  lesson?: string | undefined;
  /** What the phone bar names, when it is not the page title. */
  current?: string;
  progress?: ReactNode;
  reset?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function StudentShell({ title, lesson, current, progress, reset, footer, children }: StudentShellProps) {
  const { t } = useTranslation();
  const panel = (
    <>
      {lesson ? <p className="stu-lesson">{lesson}</p> : null}
      {reset}
      {progress}
      <div className="stu-tools">
        <div className="stu-pair">
          <Link to="/s/assignments" className="btn secondary sm">
            <History className="ico" aria-hidden="true" />
            {t('student.shell.runs')}
          </Link>
          <SwitchSide to="teacher" short />
        </div>
        <LangSwitch />
      </div>
    </>
  );

  return (
    <PanelShell phoneTitle={current ?? title ?? lesson} label={t('student.shell.panel')} panel={panel}>
      <main className="stu-in stu-body w-full grow">
        {title ? <h1 className="h1">{title}</h1> : null}
        {children}
      </main>
      {footer ? (
        <footer className="stu-foot">
          <div className="stu-in row">{footer}</div>
        </footer>
      ) : null}
      <LegalFooter />
    </PanelShell>
  );
}
