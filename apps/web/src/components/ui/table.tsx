import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Table. The wrapper scrolls sideways on its own so the page never does. */
function Table({ className, wrapperProps, ...props }: ComponentProps<'table'> & { wrapperProps?: ComponentProps<'div'> }) {
  return (
    <div data-slot="table-container" {...wrapperProps} className={cn('relative min-w-0 overflow-x-auto', wrapperProps?.className)}>
      <table data-slot="table" className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={className} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child>td]:border-b-0', className)} {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={className} {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th data-slot="table-head" className={cn('border-b border-line bg-subtle px-3.5 py-2.25 text-left text-xs font-semibold text-ink-2', className)} {...props} />;
}

function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('border-b border-line px-3.5 py-3 align-top', className)} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
