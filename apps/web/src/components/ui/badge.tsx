import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.75 text-xs leading-snug font-semibold', {
  variants: {
    kind: {
      pass: 'border-green-line bg-green-bg text-green',
      review: 'border-orange-line bg-orange-bg text-orange',
      block: 'border-red-line bg-red-bg text-red',
      info: 'border-accent-line bg-accent-bg text-accent-ink',
      neutral: 'border-line bg-gray text-ink-2',
      teacher: 'border-purple-line bg-purple-bg text-purple',
      stale: 'border-dashed border-line-strong bg-surface text-ink-2',
    },
  },
  defaultVariants: { kind: 'neutral' },
});

/** shadcn/ui Badge with LOGINA's status kinds. */
function Badge({ className, kind, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ kind }), className)} {...props} />;
}

export { Badge, badgeVariants };
