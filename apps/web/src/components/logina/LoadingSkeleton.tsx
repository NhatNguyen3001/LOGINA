import { useTranslation } from 'react-i18next';

/** Stands in for a page while its data loads. A screen reader hears the word; the shapes are hidden from it. */
export function LoadingSkeleton({ cards = 1 }: { cards?: number }) {
  const { t } = useTranslation();
  const list = cards > 1;
  return (
    <div role="status" aria-label={t('common.loading')} className="stack">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className={`card skeleton ${list ? 'tight' : ''}`}>
          <span className="bone head" aria-hidden="true" />
          <span className="bone" aria-hidden="true" />
          {list ? null : <span className="bone" aria-hidden="true" />}
          {list ? null : <span className="bone" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
