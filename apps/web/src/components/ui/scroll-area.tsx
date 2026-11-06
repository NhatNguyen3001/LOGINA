import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import type { ComponentProps, Ref } from 'react';
import { cn } from '@/lib/utils';

type ViewportProps = Omit<ComponentProps<typeof ScrollAreaPrimitive.Viewport>, 'ref' | 'className'>;

/** shadcn/ui Scroll Area. The viewport ref and props let a caller follow new content and label the region. */
function ScrollArea({
  className,
  children,
  viewportRef,
  viewportClassName,
  viewportProps,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Root> & { viewportRef?: Ref<HTMLDivElement>; viewportClassName?: string; viewportProps?: ViewportProps }) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn('relative', className)} {...props}>
      <ScrollAreaPrimitive.Viewport ref={viewportRef} data-slot="scroll-area-viewport" className={cn('size-full', viewportClassName)} {...viewportProps}>
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({ className, orientation = 'vertical', ...props }: ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn('flex touch-none p-px transition-colors select-none', orientation === 'vertical' ? 'h-full w-2.5 border-l border-l-transparent' : 'h-2.5 flex-col border-t border-t-transparent', className)}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb data-slot="scroll-area-thumb" className="scroll-thumb relative flex-1 rounded-full" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { ScrollArea, ScrollBar };
