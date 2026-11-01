import type { Slot } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { Pick } from '@/components/logina/Pick';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { ApiError, chooseSufficiency, getLesson, getTasks, newKey } from '@/lib/api';
import { jobFinished, qk, useJobPolling } from '@/lib/query';
import { readableSourceRefs } from '@/lib/source-refs';
import { useSecondsSince } from '@/lib/use-seconds-since';
import { TaskStatusTag } from './task-status';

const CHOICES = ['REFOCUS', 'ADD_SOURCE', 'LEAVE_EMPTY'] as const;
const SUFFICIENCY_KIND = { SUFFICIENT: 'pass', UNCERTAIN: 'review', INSUFFICIENT: 'block' } as const;

function Q4Decision({ lessonId, slot, version }: { lessonId: string; slot: Slot; version: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<(typeof CHOICES)[number]>('REFOCUS');

  const send = useMutation({
    mutationFn: () => chooseSufficiency(lessonId, slot, { choice, baseVersion: version }, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.lesson(lessonId) });
      if (choice === 'ADD_SOURCE') await navigate({ to: '/t/lessons/$id/source/edit', params: { id: lessonId } });
    },
  });

  return (
    <div className="card b-orange">
      <div className="row">
        <h3 className="s15 b">{t('teacher.t06.needsDecision', { slot })}</h3>
        <span className="sp" />
        <span className="s13 muted">{t('teacher.t06.othersContinue')}</span>
      </div>
      <div className="stack" role="radiogroup" aria-label={t('teacher.t06.needsDecision', { slot })}>
        {CHOICES.map((value) => (
          <Pick key={value} name="sufficiency" value={value} checked={choice === value} onSelect={() => setChoice(value)}>
            <span className="block b">{t(`teacher.t06.choice.${value}`)}</span>
            <span className="small muted">{t(`teacher.t06.choiceNote.${value}`)}</span>
          </Pick>
        ))}
      </div>
      {send.isError ? <Note kind="err">{t(errorKey(send.error instanceof ApiError ? send.error.code : ''))}</Note> : null}
      <div className="row">
        <span className="sp" />
        <button type="button" className="btn primary sm" disabled={send.isPending} onClick={() => send.mutate()}>{t('teacher.t06.regenerate', { slot })}</button>
      </div>
    </div>
  );
}

export function TasksPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const job = useJobPolling(lesson.data?.activeJobId);
  const finished = jobFinished(job.data);
  const running = Boolean(lesson.data?.activeJobId) && !finished;
  const seconds = useSecondsSince(running ? job.data?.startedAt : undefined);
  /** Kept in state: reloading the lesson clears activeJobId, and the job with it. */
  const [failure, setFailure] = useState<string | null>(null);
  const tasks = useQuery({ queryKey: qk.tasks(id), queryFn: () => getTasks(id), refetchInterval: running ? 2000 : false });

  useEffect(() => {
    if (!finished) return;
    if (job.data?.status === 'FAILED' || job.data?.status === 'TIMED_OUT') setFailure(job.data.errorCode ?? '');
    void queryClient.invalidateQueries({ queryKey: ['lesson', id] });
  }, [finished, id, job.data?.errorCode, job.data?.status, queryClient]);

  const slots = tasks.data?.slots ?? [];
  const ready = slots.filter((s) => s.draftStatus).length;
  const paused = slots.find((s) => s.sufficiency !== 'SUFFICIENT' && !s.draftStatus);
  /** Approval 2 reads every draft and its check, so it can't open before those exist. */
  const canApprove = !running && slots.length > 0 && ready === slots.length;

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t06.title')}</span>
      </nav>
      <Stepper current={3} />
      <div className="stack">
        <h1 className="h1">{t('teacher.t06.title')}</h1>
        <p className="lede">{t('teacher.t06.lede')}</p>
      </div>
      {running && lesson.data?.aiMode === 'LIVE' ? (
        <Note kind="info">
          <span>{t('teacher.t06.wait')}</span>
          {seconds === null ? null : <span className="block num">{t('teacher.t06.elapsed', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}</span>}
        </Note>
      ) : null}
      {failure !== null && !running ? <Note kind="err">{t(errorKey(failure))}</Note> : null}
      {tasks.isPending ? <LoadingSkeleton /> : null}
      {tasks.isError ? <Note kind="err">{t('errors.generic')}</Note> : null}
      {tasks.data ? <div className="card flush">
        <div className="row p-4">
          <h3 className="s15 b">{t('teacher.t06.count')}</h3>
          <span className="sp" />
          <span className="s13 sec num">{t('teacher.t06.ready', { ready, total: slots.length })}</span>
        </div>
        <div className="tbl-wrap">
          <table className="t stack-sm">
            <thead>
              <tr>
                <th>{t('student.result.task')}</th>
                <th>{t('teacher.t06.enough')}</th>
                <th>{t('teacher.t06.draft')}</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.slot}>
                  <td>
                    {slot.draftStatus ? <Link to="/t/lessons/$id/tasks/$slot" params={{ id, slot: slot.slot }} className="lnk">{t(`teacher.taskType.${slot.slot}`)}</Link> : <span className="b">{t(`teacher.taskType.${slot.slot}`)}</span>}
                  </td>
                  <td data-label={t('teacher.t06.enough')}>
                    <div className="stack">
                      {slot.sufficiency ? (
                        <StatusTag kind={SUFFICIENCY_KIND[slot.sufficiency]}>{t(`teacher.t06.sufficiency.${slot.sufficiency}`)}</StatusTag>
                      ) : (
                        <StatusTag kind="neutral">{t(running ? 'teacher.t06.checking' : 'teacher.t06.notChecked')}</StatusTag>
                      )}
                      <span className="s13">{slot.sufficiencyNote}</span>
                      <span className="src">{readableSourceRefs(slot.sourceRefs, t)}</span>
                    </div>
                  </td>
                  <td data-label={t('teacher.t06.draft')}>
                    <div className="stack">
                      {slot.draftStatus ? <TaskStatusTag status={slot.draftStatus} /> : null}
                      {slot.progress === 'FAILED' || (running && slot.progress !== 'READY') ? <span className="s13 b">{t(`teacher.t06.progress.${slot.progress}`)}</span> : null}
                      {!running && !slot.draftStatus ? <span className="s13 b">{t('teacher.t06.paused')}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> : null}
      {paused && lesson.data && !running ? <Q4Decision lessonId={id} slot={paused.slot} version={lesson.data.version} /> : null}
      <div className="row">
        {canApprove ? null : <span className="s13 sec">{t('teacher.t06.approvalWhy')}</span>}
        <span className="sp" />
        {canApprove ? <Link to="/t/lessons/$id/approve" params={{ id }} className="btn primary">{t('teacher.goApproval')}</Link> : <button type="button" className="btn primary" disabled>{t('teacher.goApproval')}</button>}
      </div>
    </>
  );
}
