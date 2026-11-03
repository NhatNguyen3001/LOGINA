import { useTranslation } from 'react-i18next';
import { alertVariants } from '@/components/ui/alert';
import { useBusy } from '@/lib/busy';
import { cn } from '@/lib/utils';

/** Students never see a limit as such: only that LOGINA is busy and their work is safe. */
export function BusyNote({ side }: { side: 'teacher' | 'student' }) {
  const { t } = useTranslation();
  if (!useBusy()) return null;
  return (
    <div role="status" className={cn(alertVariants({ kind: 'info' }), side === 'teacher' && 'fixed right-4 bottom-4 z-20 max-w-md shadow-card')}>
      {t(side === 'teacher' ? 'limits.busyTeacher' : 'limits.busyStudent')}
    </div>
  );
}
