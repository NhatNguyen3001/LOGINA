import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const cardVariants = cva('flex min-w-0 flex-col rounded-lg border bg-surface', {
  variants: {
    tone: { default: 'gap-3 p-5', tight: 'gap-2.5 p-4', flush: 'gap-0' },
    edge: { none: 'border-line', accent: 'border-accent-line', orange: 'border-orange-line', red: 'border-red-line' },
  },
  defaultVariants: { tone: 'default', edge: 'none' },
});

/** shadcn/ui Card. `tone` matches the old .card, .card.tight and .card.flush; `edge` the coloured borders. */
function Card({ className, tone, edge, ...props }: ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ tone, edge }), className)} {...props} />;
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1', className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 data-slot="card-title" className={cn('font-semibold text-ink', className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('flex flex-col gap-3', className)} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle, cardVariants };
