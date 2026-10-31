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
import { qk, useJobPolling } from '@/lib/query';
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
  const running = Boolean(lesson.data?.activeJobId) && job.data?.status !== 'DONE';
  const tasks = useQuery({ queryKey: qk.tasks(id), queryFn: () => getTasks(id), refetchInterval: running ? 2000 : false });

  useEffect(() => {
    if (job.data?.status === 'DONE') void queryClient.invalidateQueries({ queryKey: ['lesson', id] });
  }, [id, job.data?.status, queryClient]);

  const slots = tasks.data?.slots ?? [];
  const ready = slots.filter((s) => s.draftStatus).length;
  const paused = slots.find((s) => s.sufficiency !== 'SUFFICIENT' && !s.draftStatus);

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
      {tasks.isPending ? <LoadingSkeleton /> : null}
      {tasks.isError ? <Note kind="err">{t('errors.generic')}</Note> : null}
      {tasks.data ? <div className="card flush">
        <div className="row p-4">
          <h3 className="s15 b">{t('teacher.t06.count')}</h3>
          <span className="sp" />
          <span className="s13 sec num">{t('teacher.t06.ready', { ready, total: slots.length })}</span>
        </div>
        <div className="tbl-wrap">
          <table className="t">
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
                  <td>
                    <div className="stack">
                      <StatusTag kind={SUFFICIENCY_KIND[slot.sufficiency]}>{t(`teacher.t06.sufficiency.${slot.sufficiency}`)}</StatusTag>
                      <span className="s13">{slot.sufficiencyNote}</span>
                      <span className="src">{slot.sourceRefs.join(' · ')}</span>
                    </div>
                  </td>
                  <td>{slot.draftStatus ? <TaskStatusTag status={slot.draftStatus} /> : <span className="s13 b">{t(paused?.slot === slot.slot ? 'teacher.t06.paused' : 'teacher.t06.drafting')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> : null}
      {paused && lesson.data && !running ? <Q4Decision lessonId={id} slot={paused.slot} version={lesson.data.version} /> : null}
      <div className="row">
        <span className="sp" />
        <Link to="/t/lessons/$id/approve" params={{ id }} className="btn primary">{t('teacher.goApproval')}</Link>
      </div>
    </>
  );
}
