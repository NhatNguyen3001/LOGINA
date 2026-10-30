import type { ReactNode } from 'react';
import { LangSwitch } from './LangSwitch';

interface StudentShellProps {
  title: string;
  progress?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function StudentShell({ title, progress, actions, footer, children }: StudentShellProps) {
  return (
    <div className="min-h-dvh bg-page">
      <header className="stu-top">
        <div className="stu-in">
          <div className="row">
            <span className="b s15">{title}</span>
            <span className="sp" />
            <LangSwitch />
            {actions}
          </div>
          {progress}
        </div>
      </header>
      <main className="stu-in stu-body">{children}</main>
      {footer ? (
        <footer className="stu-foot">
          <div className="stu-in row">{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
