import type { ReactNode } from 'react';
import { LegalFooter } from './LegalFooter';

interface EditorShellProps {
  header: ReactNode;
  stepper?: ReactNode;
  taskList: ReactNode;
  side: ReactNode;
  children: ReactNode;
}

export function EditorShell({ header, stepper, taskList, side, children }: EditorShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="ed-top">{header}</header>
      {stepper ? <div className="ed-sub">{stepper}</div> : null}
      <div className="ed grow">
        <nav className="ed-nav">{taskList}</nav>
        <main className="ed-main">{children}</main>
        <aside className="ed-side">{side}</aside>
      </div>
      <LegalFooter />
    </div>
  );
}
