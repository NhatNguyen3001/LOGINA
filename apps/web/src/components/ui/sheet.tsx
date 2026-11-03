import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Sheet: a panel that slides in. Radix keeps focus inside, closes on Escape and returns focus to the opener. */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SIDES = {
  right: 'inset-y-0 right-0 h-full w-full max-w-100 border-l',
  top: 'inset-x-0 top-0 max-h-dvh border-b',
} as const;

function SheetContent({ className, children, side = 'right', closeLabel, overlay = true, ...props }: ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES; closeLabel: string; overlay?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      {overlay ? <SheetPrimitive.Overlay data-slot="sheet-overlay" className="sheet-overlay fixed inset-0 z-40 bg-ink/40" /> : null}
      <SheetPrimitive.Content data-slot="sheet-content" data-side={side} className={cn('sheet fixed z-50 flex flex-col gap-3 overflow-y-auto border-line bg-surface p-5 text-ink shadow-card outline-none', SIDES[side], className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 grid size-8 cursor-pointer place-items-center rounded-md border border-line bg-surface text-ink-2 hover:bg-subtle hover:text-accent-ink" aria-label={closeLabel}>
          <X className="size-4" aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn('pr-10 text-md font-semibold', className)} {...props} />;
}

function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn('text-sm text-ink-2', className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
