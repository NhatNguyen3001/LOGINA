import type { ReactNode } from 'react';

interface EditorShellProps {
  header: ReactNode;
  stepper?: ReactNode;
  taskList: ReactNode;
  side: ReactNode;
  children: ReactNode;
}

export function EditorShell({ header, stepper, taskList, side, children }: EditorShellProps) {
  return (
    <div className="min-h-dvh bg-page">
      <header className="ed-top">{header}</header>
      {stepper ? <div className="ed-sub">{stepper}</div> : null}
      <div className="ed">
        <nav className="ed-nav">{taskList}</nav>
        <main className="ed-main">{children}</main>
        <aside className="ed-side">{side}</aside>
      </div>
    </div>
  );
}
