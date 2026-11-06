import type { JobDTO } from '@logina/contracts';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';

export type AiWait = NonNullable<JobDTO['waits']>[number];

const secondsUntil = (iso: string): number => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));

/** Amber, not red: nothing has failed yet. Counts down so a long pause never looks frozen. */
export function AiBusyNote({ wait }: { wait: AiWait }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(() => secondsUntil(wait.retryAt));

  useEffect(() => {
    setLeft(secondsUntil(wait.retryAt));
    const timer = setInterval(() => setLeft(secondsUntil(wait.retryAt)), 1000);
    return () => clearInterval(timer);
  }, [wait.retryAt]);

  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <Note kind="warn">
      <span className="s13">{left > 0 ? t('teacher.busy.waiting', { time, attempt: wait.attempt, of: wait.of }) : t('teacher.busy.now', { attempt: wait.attempt, of: wait.of })}</span>
    </Note>
  );
}

/** Which wait belongs to a task row: step labels end with the slot, as in "draft Q3". */
export const waitForSlot = (waits: JobDTO['waits'], slot: string): AiWait | undefined => waits?.find((wait) => wait.step.split(' ').at(-1) === slot);
