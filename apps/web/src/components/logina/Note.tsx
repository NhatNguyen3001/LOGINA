import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type NoteKind = 'info' | 'warn' | 'err' | 'ok';

const ICONS: Record<NoteKind, LucideIcon> = { info: Info, warn: AlertTriangle, err: XCircle, ok: CheckCircle2 };

export function Note({ kind, children }: { kind: NoteKind; children: ReactNode }) {
  const Icon = ICONS[kind];
  return (
    <div className={`note ${kind}`} role={kind === 'err' ? 'alert' : undefined}>
      <Icon className="ico" aria-hidden="true" />
      <div className="grow">{children}</div>
    </div>
  );
}
