import type { ComponentProps } from 'react';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(fieldClass, 'min-h-20', className)} {...props} />;
}

export { Textarea };
