import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { reloadApp } from '@/lib/app-version';

/**
 * Shown when a screen crashes, in the chosen language. The technical message goes to the console only:
 * a teacher or student needs to know their work is safe and what to press, not what React said.
 */
export function CrashScreen({ error }: { error: unknown }) {
  const { t } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="crash">
      <div className="crash-in stack">
        <h1 className="h1">{t('crash.title')}</h1>
        <p className="lede">{t('crash.body')}</p>
        <div className="row">
          <button type="button" className={buttonVariants()} onClick={reloadApp}>{t('update.reload')}</button>
          <a href="/" className={buttonVariants({ variant: 'secondary' })}>{t('crash.home')}</a>
        </div>
      </div>
    </main>
  );
}
