import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Accordion. Closed panels stay in the page (forceMount + hidden) so text is still findable and printable. */
const Accordion = AccordionPrimitive.Root;

function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn('acc-item rounded-lg border border-line bg-surface', className)} {...props} />;
}

/** The heading prop keeps the page outline right: policy and consent rows are h2, Radix's default is h3. */
function AccordionTrigger({ className, children, heading: Heading = 'h3', ...props }: ComponentProps<typeof AccordionPrimitive.Trigger> & { heading?: 'h2' | 'h3' }) {
  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="m-0 flex">
      <AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn('group flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg px-4.5 py-3 text-left text-md font-semibold text-ink outline-none hover:bg-subtle focus-visible:ring-3 focus-visible:ring-accent-bg aria-expanded:text-accent-ink', className)} {...props}>
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-aria-expanded:rotate-180 group-aria-expanded:text-accent-ink" aria-hidden="true" />
      </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content data-slot="accordion-content" forceMount className="acc-panel" {...props}>
      <div className={cn('flex flex-col gap-2.5 px-4.5 pt-0 pb-4 text-ink-2', className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
