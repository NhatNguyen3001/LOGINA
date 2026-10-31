import type { ReactNode } from 'react';

export function DiffRow({ kind, children }: { kind: 'del' | 'add'; children: ReactNode }) {
  return (
    <div className={`note ${kind === 'del' ? 'err' : 'ok'}`}>
      <span aria-hidden="true">{kind === 'del' ? '−' : '+'}</span>
      {kind === 'del' ? <del>{children}</del> : <ins className="no-underline">{children}</ins>}
    </div>
  );
}
