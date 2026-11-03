import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm text-ink [&_b]:font-semibold [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', {
  variants: {
    kind: {
      info: 'border-accent-line bg-accent-bg [&>svg]:text-accent-ink',
      warn: 'border-orange-line bg-orange-bg [&>svg]:text-orange',
      err: 'border-red-line bg-red-bg [&>svg]:text-red',
      ok: 'border-green-line bg-green-bg [&>svg]:text-green',
    },
  },
  defaultVariants: { kind: 'info' },
});

/** shadcn/ui Alert with LOGINA's four note kinds. */
function Alert({ className, kind, ...props }: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ kind }), className)} {...props} />;
}

export { Alert, alertVariants };
