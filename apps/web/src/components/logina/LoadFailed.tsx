import { useTranslation } from 'react-i18next';
import { Note } from './Note';
import { buttonVariants } from '@/components/ui/button';

/** For a page that could not load, so nobody is left looking at a skeleton. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Note kind="err">
      <p>{t('common.loadFailed')}</p>
      <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={onRetry}>{t('common.retry')}</button>
    </Note>
  );
}
