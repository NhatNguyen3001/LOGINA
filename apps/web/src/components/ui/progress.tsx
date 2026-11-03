import * as ProgressPrimitive from '@radix-ui/react-progress';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function Progress({ className, value, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-gray', className)} {...props}>
      <ProgressPrimitive.Indicator data-slot="progress-indicator" className="h-full bg-accent transition-transform duration-300" style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }} />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
