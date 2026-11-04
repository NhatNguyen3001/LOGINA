import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Autosave } from '@/features/student/use-autosave';
import { cn } from '@/lib/utils';

/** The region stays on the page, so a screen reader hears each change. Try again sits outside it, so it is not read out twice. */
export function SaveStatus({ save }: { save: Autosave }) {
  const { t } = useTranslation();
  const { state } = save;
  return (
    <span className="save-status">
      <span role="status" className={cn('save-pill', state)}>
        {state === 'saving' ? <><LoaderCircle className="ico motion-safe:animate-spin" aria-hidden="true" />{t('student.save.saving')}</> : null}
        {state === 'saved' ? <><CircleCheck className="ico" aria-hidden="true" />{t('common.saved')}</> : null}
        {state === 'failed' ? <><CircleAlert className="ico" aria-hidden="true" />{t('student.save.failed')}</> : null}
      </span>
      {state === 'failed' ? <button type="button" className="lnk" onClick={save.retry}>{t('common.retry')}</button> : null}
    </span>
  );
}
