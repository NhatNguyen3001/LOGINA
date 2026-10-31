import { useTranslation } from 'react-i18next';

/** Stands in for a page while its data loads. A screen reader hears the word; the shapes are hidden from it. */
export function LoadingSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="card skeleton">
      <span className="bone head" aria-hidden="true" />
      <span className="bone" aria-hidden="true" />
      <span className="bone" aria-hidden="true" />
      <span className="bone" aria-hidden="true" />
    </div>
  );
}
