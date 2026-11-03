import { useMutation } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { newKey, resetAttempt } from '@/lib/api';

/** Asks first, since a reset drops the answers; a full load then drops the page's task state. */
export function ResetRun({ attemptId }: { attemptId: string }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const reset = useMutation({
    mutationFn: () => resetAttempt(attemptId, newKey()),
    onSuccess: () => window.location.assign(`/s/attempts/${attemptId}/Q1`),
  });

  return (
    <AlertDialog open={asking} onOpenChange={(next) => !reset.isPending && setAsking(next)}>
      <AlertDialogTrigger className="lnk jump stu-reset">
        <RotateCcw className="ico" aria-hidden="true" />
        {t('student.shell.reset')}
      </AlertDialogTrigger>
      <AlertDialogContent aria-describedby={undefined}>
        <AlertDialogTitle>{t('student.shell.resetTitle')}</AlertDialogTitle>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>{t('student.shell.resetCancel')}</AlertDialogCancel>
          <button type="button" className={buttonVariants()} aria-busy={reset.isPending} disabled={reset.isPending} onClick={() => reset.mutate()}>{t('student.shell.resetConfirm')}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
