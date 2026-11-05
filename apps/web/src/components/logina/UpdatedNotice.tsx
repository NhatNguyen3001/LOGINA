import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { buttonVariants } from '@/components/ui/button';
import { reloadApp } from '@/lib/app-version';

/** LOGINA changed under an open tab. A teacher's typed text stays on screen, with a way to copy it before reloading. */
export function UpdatedNotice({ text }: { text?: string | undefined }) {
  const { t } = useTranslation();
  return (
    <Note kind="info">
      <p>{t('errors.APP_UPDATED')}</p>
      <div className="row">
        <button type="button" className={buttonVariants({ size: 'sm' })} onClick={reloadApp}>{t('update.reload')}</button>
        {text ? <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => void navigator.clipboard.writeText(text)}>{t('update.copyText')}</button> : null}
      </div>
    </Note>
  );
}

/** Shown in place of a screen whose code file a newer version replaced. */
export function ScreenGone() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <Note kind="info">
        <p>{t('update.screenGone')}</p>
        <button type="button" className={buttonVariants({ size: 'sm' })} onClick={reloadApp}>{t('update.reload')}</button>
      </Note>
    </div>
  );
}
