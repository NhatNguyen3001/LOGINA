import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { newKey, resetAttempt } from '@/lib/api';

/** A native modal, so focus, Escape and the backdrop need no extra code. A full load drops the page's task state. */
export function ResetRun({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const reset = useMutation({
    mutationFn: () => resetAttempt(attemptId, newKey()),
    onSuccess: () => window.location.assign(`/s/attempts/${attemptId}/Q1`),
  });

  return (
    <>
      <button type="button" className="btn secondary sm" onClick={() => setAsking(true)}>{t('student.shell.reset')}</button>
      {asking ? (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          className="card dialog"
          aria-labelledby="reset-title"
          onClose={() => setAsking(false)}
        >
          <h2 id="reset-title" className="s15 b">{t('student.shell.resetTitle')}</h2>
          <div className="row">
            <span className="sp" />
            <button type="button" className="btn secondary" disabled={reset.isPending} onClick={() => setAsking(false)}>{t('student.shell.resetCancel')}</button>
            <button type="button" className="btn primary" disabled={reset.isPending} onClick={() => reset.mutate()}>{t('student.shell.resetConfirm')}</button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
