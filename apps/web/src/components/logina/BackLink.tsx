import { Link, type LinkProps } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A shadcn secondary button that goes one level up, for screens reached from a list. */
export function BackLink({ label, ...link }: LinkProps & { label: string }) {
  return (
    <Link {...link} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'group self-start no-underline')}>
      <ArrowLeft className="ico transition-transform duration-150 motion-safe:group-hover:-translate-x-0.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
