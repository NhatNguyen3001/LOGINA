import type { ReactNode } from 'react';

export function StickyActionBar({ children }: { children: ReactNode }) {
  return <div className="card tight dock print:static">{children}</div>;
}
