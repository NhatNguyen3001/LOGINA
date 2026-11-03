import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Note } from './Note';
import { buttonVariants } from '@/components/ui/button';
import { demoReset, newKey } from '@/lib/api';
import { errorAction, errorText } from '@/lib/errors';
import { reloadHome } from '@/lib/reload-home';

/** For a page that could not load: it says why in plain words and offers the one thing that helps. */
export function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const reset = useMutation({
    mutationFn: () => demoReset(newKey()),
    onSuccess: reloadHome,
  });
  const action = errorAction(error);
  return (
    <Note kind="err">
      <p>{t(errorText(error))}</p>
      {action === 'reset' ? (
        <button type="button" className={buttonVariants({ size: 'sm' })} aria-busy={reset.isPending} disabled={reset.isPending} onClick={() => reset.mutate()}>{t('common.resetDemo')}</button>
      ) : (
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={onRetry}>{t('common.retry')}</button>
      )}
      {reset.isError ? <p>{t(errorText(reset.error))}</p> : null}
    </Note>
  );
}
