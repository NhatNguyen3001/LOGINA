import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newKey, resetAttempt } from '@/lib/api';

/** Asks once before clearing. A full load drops the task state held on the page. */
export function ResetRun({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const reset = useMutation({
    mutationFn: () => resetAttempt(attemptId, newKey()),
    onSuccess: () => window.location.assign(`/s/attempts/${attemptId}/Q1`),
  });

  if (!asking) {
    return <button type="button" className="btn secondary sm" onClick={() => setAsking(true)}>{t('student.shell.reset')}</button>;
  }
  return (
    <>
      <button type="button" className="btn secondary sm" disabled={reset.isPending} onClick={() => setAsking(false)}>{t('student.shell.resetCancel')}</button>
      <button type="button" className="btn primary sm" disabled={reset.isPending} onClick={() => reset.mutate()}>{t('student.shell.resetConfirm')}</button>
    </>
  );
}
