import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { errorKey } from '@/i18n';
import { ApiError, newKey, startAnalyze } from '@/lib/api';
import { qk } from '@/lib/query';

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
    <div className="card">
      <h1 className="h1">{t('teacher.t02.notAnalyzed')}</h1>
      <p className="lede">{t('teacher.t02.notAnalyzedNote')}</p>
      {restart.isError ? <Note kind="err">{t(errorKey(restart.error instanceof ApiError ? restart.error.code : ''))}</Note> : null}
      <div className="row">
        <button type="button" className="btn primary" disabled={restart.isPending} onClick={() => restart.mutate()}>{t('teacher.t01.analyze')}</button>
        <Link to="/t/lessons/new" className="btn secondary">{t('lessons.new')}</Link>
      </div>
    </div>
  );
}
