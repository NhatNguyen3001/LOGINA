import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Button in LOGINA colours. A busy button shows a spinner (styled in components.css) and a disabled one keeps its grey on hover. */
const buttonVariants = cva(
  'ui-btn inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-semibold no-underline transition duration-150 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray disabled:text-ink-3',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-accent text-on-accent enabled:hover:bg-accent-hover',
        secondary: 'border-line-strong bg-surface text-ink enabled:hover:border-control enabled:hover:bg-subtle',
        danger: 'border-red-line bg-surface text-red enabled:hover:bg-red-bg',
        choice: 'border-accent bg-surface text-accent-ink enabled:hover:bg-accent-bg',
      },
      size: {
        md: 'min-h-10 px-4.5 py-2.5 text-base',
        sm: 'min-h-9 px-3 py-1.5 text-sm',
        icon: 'size-8 p-0 [&_svg]:size-4',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, block, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export { Button, buttonVariants };
