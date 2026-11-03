import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Shared by Input, Textarea and the Select trigger so every field looks the same. */
const fieldClass =
  'w-full min-w-0 rounded-md border border-control bg-surface px-3 py-2.25 text-base text-ink transition duration-150 outline-none placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-bg disabled:cursor-not-allowed disabled:bg-gray aria-invalid:border-red';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(fieldClass, className)} {...props} />;
}

export { fieldClass, Input };
