import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { newKey, startAnalyze } from '@/lib/api';
import { qk } from '@/lib/query';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { errorText } from '@/lib/errors';

/** For a lesson whose analysis was stopped, refused or failed. */
export function RestartAnalysis({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const restart = useMutation({
    mutationFn: () => startAnalyze(lessonId, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.lesson(lessonId) });
      await navigate({ to: '/t/lessons/$id/analyze', params: { id: lessonId } });
    },
  });
  return (
    <div className={cardVariants()}>
      <h1 className="h1">{t('teacher.t02.notAnalyzed')}</h1>
      <p className="lede">{t('teacher.t02.notAnalyzedNote')}</p>
      {restart.isError ? <Note kind="err">{t(errorText(restart.error))}</Note> : null}
      <div className="row">
        <button type="button" className={buttonVariants()} aria-busy={restart.isPending} disabled={restart.isPending} onClick={() => restart.mutate()}>{t('teacher.t01.analyze')}</button>
        <Link to="/t/lessons/new" className={buttonVariants({ variant: 'secondary' })}>{t('lessons.new')}</Link>
      </div>
    </div>
  );
}
