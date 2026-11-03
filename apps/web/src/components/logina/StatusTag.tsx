import { AlertTriangle, Ban, Check, Circle, Clock, Info, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export type TagKind = 'pass' | 'review' | 'block' | 'info' | 'neutral' | 'teacher' | 'stale';

const ICONS: Record<TagKind, LucideIcon> = { pass: Check, review: AlertTriangle, block: Ban, info: Info, neutral: Circle, teacher: ShieldCheck, stale: Clock };

/** Status is never color alone: every tag has an icon and a label. */
export function StatusTag({ kind, icon, children }: { kind: TagKind; icon?: LucideIcon; children: ReactNode }) {
  const Icon = icon ?? ICONS[kind];
  return (
    <Badge kind={kind}>
      <Icon className="size-3.25 shrink-0" aria-hidden="true" />
      {children}
    </Badge>
  );
}
