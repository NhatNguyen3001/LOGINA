import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('flex flex-col gap-2', className)} {...props} />;
}

/** A whole card is the radio, like the old Pick: the item carries its own label as children. */
function RadioGroupItem({ className, children, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn('group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-left text-ink transition duration-150 outline-none hover:border-control focus-visible:ring-3 focus-visible:ring-accent-bg aria-checked:border-accent aria-checked:bg-accent-bg aria-checked:inset-ring aria-checked:inset-ring-accent disabled:cursor-not-allowed', className)}
      {...props}
    >
      <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border border-control bg-surface group-aria-checked:border-accent" aria-hidden="true">
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-accent" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
