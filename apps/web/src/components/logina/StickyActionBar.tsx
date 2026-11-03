import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StickyActionBar({ children }: { children: ReactNode }) {
  return <div className={cn(cardVariants({ tone: 'tight' }), 'dock print:static')}>{children}</div>;
}
