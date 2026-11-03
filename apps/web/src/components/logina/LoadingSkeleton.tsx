import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Stands in for a page while its data loads. A screen reader hears the word; the shapes are hidden from it. */
export function LoadingSkeleton({ cards = 1 }: { cards?: number }) {
  const { t } = useTranslation();
  const list = cards > 1;
  return (
    <div role="status" aria-label={t('common.loading')} className="stack">
      {Array.from({ length: cards }, (_, index) => (
        <Card key={index} tone={list ? 'tight' : 'default'} aria-hidden="true">
          <Skeleton className="h-4.5 w-2/5" />
          <Skeleton />
          {list ? null : <Skeleton />}
          {list ? null : <Skeleton className="w-3/5" />}
        </Card>
      ))}
    </div>
  );
}
