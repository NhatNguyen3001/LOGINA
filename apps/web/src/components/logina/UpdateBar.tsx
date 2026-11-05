import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { reloadApp, useOutdated } from '@/lib/app-version';
import { useHasUnsavedText } from '@/lib/unsaved';

/** Says a newer LOGINA is live. It never blocks; with unsaved text open, Reload asks first. */
export function UpdateBar() {
  const { t } = useTranslation();
  const outdated = useOutdated();
  const unsaved = useHasUnsavedText();
  const [asking, setAsking] = useState(false);
  if (!outdated) return null;
  return (
    <div className="update-bar">
      <div role="status" className="update-bar-in">
        <RefreshCw className="ico" aria-hidden="true" />
        <span className="grow">{t(unsaved ? 'update.saveFirst' : 'update.ready')}</span>
        <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => (unsaved ? setAsking(true) : reloadApp())}>{t('update.reload')}</button>
      </div>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('update.unsavedTitle')}</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('update.keepEditing')}</AlertDialogCancel>
            <button type="button" className={buttonVariants()} onClick={reloadApp}>{t('update.reload')}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
