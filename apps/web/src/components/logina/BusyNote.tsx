import { useTranslation } from 'react-i18next';
import { useBusy } from '@/lib/busy';

/** Students never see a limit as such: only that LOGINA is busy and their work is safe. */
export function BusyNote({ side }: { side: 'teacher' | 'student' }) {
  const { t } = useTranslation();
  if (!useBusy()) return null;
  return (
    <div role="status" className={side === 'teacher' ? 'note info fixed right-4 bottom-4 z-20 max-w-md shadow-card' : 'note info'}>
      {t(side === 'teacher' ? 'limits.busyTeacher' : 'limits.busyStudent')}
    </div>
  );
}
