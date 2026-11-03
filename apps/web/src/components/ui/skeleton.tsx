import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('h-3 animate-pulse rounded-md bg-gray', className)} {...props} />;
}

export { Skeleton };
