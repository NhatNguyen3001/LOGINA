import * as SliderPrimitive from '@radix-ui/react-slider';
import { useMemo, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Slider on LOGINA's tokens. The thumb carries the accessible name, since it is the element with role="slider". */
function Slider({ className, defaultValue, value, min = 0, max = 100, thumbLabel, ...props }: ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel?: string }) {
  const values = useMemo(() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]), [value, defaultValue, min, max]);
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('relative flex h-11 w-full touch-none items-center select-none data-disabled:opacity-50', className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-2 w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={thumbLabel}
          className="block size-5 shrink-0 cursor-grab rounded-full border-2 border-accent bg-surface shadow-sm transition-shadow outline-none hover:ring-4 hover:ring-accent-bg focus-visible:ring-4 focus-visible:ring-accent active:cursor-grabbing"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
