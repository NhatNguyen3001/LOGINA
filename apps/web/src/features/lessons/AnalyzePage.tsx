import type { JobDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { answerJob, cancelJob, getLesson, getSourceReview, newKey, startAnalyze } from '@/lib/api';
import { qk, useJobPolling } from '@/lib/query';
import { RestartAnalysis } from './RestartAnalysis';
import { stagePath } from './stage-path';
import { useSecondsSince } from '@/lib/use-seconds-since';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAILED: JobDTO['status'][] = ['FAILED', 'TIMED_OUT'];

type Thought = NonNullable<JobDTO['trace']>[number];

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The model's own words, so they stay in English on a Vietnamese screen. */
function Thoughts({ thoughts }: { thoughts: Thought[] }) {
  return (
    <ol className="thoughts" lang="en">
      {thoughts.map(({ at, title, text }) => (
        <li key={`${at}-${title}`}>
          <time className="num">{clock(at)}</time>
          <div>
            {title ? <b>{title}</b> : null}
            {text}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepThoughts({ step }: { step: JobDTO['steps'][number] & { thoughts: Thought[] } }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState('thoughts');
  if (step.thoughts.length === 0) return null;
  if (step.status !== 'DONE') return <Thoughts thoughts={step.thoughts} />;
  return (
    <Accordion type="single" collapsible value={open} onValueChange={setOpen} className="thoughts-fold">
      <AccordionItem value="thoughts" className="border-0 bg-transparent">
        <AccordionTrigger className="min-h-0 flex-none justify-start gap-1.5 px-0 py-1 text-sm text-accent-ink hover:bg-transparent hover:underline">{t(open ? 'teacher.t02.hideThoughts' : 'teacher.t02.showThoughts', { count: step.thoughts.length })}</AccordionTrigger>
        <AccordionContent className="px-0 pb-0">
          <Thoughts thoughts={step.thoughts} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

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
  const seconds = useSecondsSince(job.data?.startedAt);

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

  if (lesson.data?.stage === 'CREATE' && !lesson.data.activeJobId) return <RestartAnalysis lessonId={id} />;
  if (lesson.data && !lesson.data.activeJobId) return <Navigate to={stagePath(lesson.data)} replace />;

  const steps = job.data?.steps ?? [];
  const done = steps.filter((s) => s.status === 'DONE').length;
  const percent = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const question = job.data?.question;
  const unreadable = lesson.isError || job.isError;

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
        <div className={cardVariants({ edge: 'accent' })}>
          <div className="row">
            <Badge kind="info">{t('teacher.t02.needChoice')}</Badge>
            <span className="sp" />
            <span className="s13 muted">{t('teacher.t02.paused')}</span>
          </div>
          <p className="s15 b">{t('teacher.t02.language.question', { detected: t(`common.lang.${question.detected}`) })}</p>
          <div className="row">
            <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => answer.mutate('USE_DETECTED')}>{t('teacher.t02.language.useDetected', { lang: t(`common.lang.${question.detected}`) })}</button>
            <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => answer.mutate('KEEP_CHOSEN')}>{t('teacher.t02.language.keepChosen', { lang: t(`common.lang.${question.chosen}`) })}</button>
          </div>
        </div>
      ) : null}
      {status && FAILED.includes(status) ? (
        <Note kind="err">
          <p className="b">{t('teacher.t02.failed')}</p>
          <p>{t(errorKey(job.data?.errorCode ?? ''))}</p>
          <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => retry.mutate()}>{t('common.retry')}</button>
        </Note>
      ) : null}
      {unreadable ? <Note kind="err">{t('errors.generic')}</Note> : null}
      {!job.data && !unreadable ? <LoadingSkeleton /> : null}
      {job.data ? <div className={cardVariants()}>
        <div className="row">
          <h3 className="s15 b">{t('teacher.t02.progress')}</h3>
          <span className="sp" />
          <span className="s13 sec num">{t('teacher.t02.steps', { done, total: steps.length })}</span>
        </div>
        <Progress value={percent} aria-label={t('teacher.t02.progress')} />
        <div className="stack">
          {steps.map((step) => (
            <div key={step.label} className="row top">
              <StepIcon status={step.status} />
              <div className="grow stack step-body">
                <span className="m">{t(`teacher.job.${step.label}`, { defaultValue: step.label })}</span>
                <StepThoughts step={{ ...step, thoughts: job.data?.trace?.filter((thought) => thought.step === step.label) ?? [] }} />
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <span className="s13 sec grow">
            {t('teacher.t02.timing')}
            {seconds === null ? null : <span className="block num">{t('teacher.t06.elapsed', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}</span>}
          </span>
          <button type="button" className={buttonVariants({ variant: 'secondary' })} aria-busy={stop.isPending} disabled={stop.isPending} onClick={() => stop.mutate()}>{t('teacher.t02.stop')}</button>
        </div>
      </div> : null}
    </>
  );
}
