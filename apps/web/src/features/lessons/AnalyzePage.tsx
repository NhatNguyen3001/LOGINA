import type { JobDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { answerJob, cancelJob, getLesson, getSourceReview, newKey, startAnalyze } from '@/lib/api';
import { qk, useJobPolling } from '@/lib/query';
import { stagePath } from './stage-path';

const FAILED: JobDTO['status'][] = ['FAILED', 'TIMED_OUT'];

function StepIcon({ status }: { status: JobDTO['steps'][number]['status'] }) {
  const { t } = useTranslation();
  if (status === 'DONE') return <span className="ok">{'✓'}</span>;
  if (status === 'RUNNING') return <span className="wait"><span className="spin" role="img" aria-label={t('teacher.t02.running')} /></span>;
  return <span className="wait">{'○'}</span>;
}

export function AnalyzePage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const job = useJobPolling(lesson.data?.activeJobId);
  const status = job.data?.status;

  useEffect(() => {
    if (status !== 'DONE') return;
    void (async () => {
      const review = await getSourceReview(id);
      await queryClient.invalidateQueries({ queryKey: qk.lesson(id) });
      await navigate({ to: review.issues.length > 0 ? '/t/lessons/$id/clarify' : '/t/lessons/$id/source', params: { id } });
    })();
  }, [id, navigate, queryClient, status]);

  const stop = useMutation({
    mutationFn: () => cancelJob(job.data!.id, newKey()),
    onSuccess: () => navigate({ to: '/t/lessons/new' }),
  });

  const answer = useMutation({
    mutationFn: (choice: 'USE_DETECTED' | 'KEEP_CHOSEN') => answerJob(job.data!.id, { choice }, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.job(job.data!.id) }),
  });

  const retry = useMutation({
    mutationFn: () => startAnalyze(id, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.lesson(id) }),
  });

  if (lesson.data && !lesson.data.activeJobId) return <Navigate to={stagePath(lesson.data)} replace />;

  const steps = job.data?.steps ?? [];
  const done = steps.filter((s) => s.status === 'DONE').length;
  const percent = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const question = job.data?.question;

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t02.crumb')}</span>
      </nav>
      <Stepper current={1} />
      <div className="stack">
        <h1 className="h1">{t('teacher.t02.title')}</h1>
        <p className="lede">{t('teacher.t02.lede')}</p>
      </div>
      {question ? (
        <div className="card b-navy">
          <div className="row">
            <span className="tag info">{t('teacher.t02.needChoice')}</span>
            <span className="sp" />
            <span className="s13 muted">{t('teacher.t02.paused')}</span>
          </div>
          <p className="s15 b">{t('teacher.t02.language.question', { detected: t(`common.lang.${question.detected}`) })}</p>
          <div className="row">
            <button type="button" className="btn primary sm" onClick={() => answer.mutate('USE_DETECTED')}>{t('teacher.t02.language.useDetected', { lang: t(`common.lang.${question.detected}`) })}</button>
            <button type="button" className="btn secondary sm" onClick={() => answer.mutate('KEEP_CHOSEN')}>{t('teacher.t02.language.keepChosen', { lang: t(`common.lang.${question.chosen}`) })}</button>
          </div>
        </div>
      ) : null}
      {status && FAILED.includes(status) ? (
        <Note kind="err">
          <p className="b">{t('teacher.t02.failed')}</p>
          <p>{t(errorKey(job.data?.errorCode ?? ''))}</p>
          <button type="button" className="btn secondary sm" onClick={() => retry.mutate()}>{t('common.retry')}</button>
        </Note>
      ) : null}
      <div className="card">
        <div className="row">
          <h3 className="s15 b">{t('teacher.t02.progress')}</h3>
          <span className="sp" />
          <span className="s13 sec num">{t('teacher.t02.steps', { done, total: steps.length })}</span>
        </div>
        <div className="slider" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('teacher.t02.progress')}>
          <div className="fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="stack">
          {steps.map((step) => (
            <div key={step.label} className="row">
              <StepIcon status={step.status} />
              <span className="m">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="row">
          <span className="s13 sec grow">{t('teacher.t02.timing')}</span>
          <button type="button" className="btn secondary" disabled={!job.data || stop.isPending} onClick={() => stop.mutate()}>{t('teacher.t02.stop')}</button>
        </div>
      </div>
    </>
  );
}
