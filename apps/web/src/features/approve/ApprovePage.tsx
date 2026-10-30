import type { Slot, TaskApprovalDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { ApiError, approveTask, getApproval, newKey, sendDisposition } from '@/lib/api';
import { qk } from '@/lib/query';
import { TaskStatusTag } from '@/features/tasks/task-status';

type Task = TaskApprovalDTO['tasks'][number];

function Decision({ lessonId, task, finding }: { lessonId: string; task: Task; finding: Task['decisionsNeeded'][number] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const accept = useMutation({
    mutationFn: () => sendDisposition(lessonId, task.slot, { decision: 'TEACHER_ACCEPT_WITH_REASON', gateId: finding.gateId, findingCode: finding.findingCode, reason, baseVersion: task.draftVersion }, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.approval(lessonId) }),
  });

  if (!finding.overridable) {
    return (
      <div className="stack">
        <StatusTag kind="block">{finding.gateId}</StatusTag>
        <span className="s13">{finding.explanationForTeacher}</span>
        <Link to="/t/lessons/$id/tasks/$slot" params={{ id: lessonId, slot: task.slot }} className="btn secondary sm self-start">{t('teacher.t12.openToFix')}</Link>
      </div>
    );
  }
  return (
    <div className="well stack">
      <StatusTag kind="review">{finding.gateId}</StatusTag>
      <span className="s13">{finding.explanationForTeacher}</span>
      <label className="small b sec" htmlFor={`reason-${task.slot}`}>{t('teacher.t12.acceptWarning')}</label>
      <textarea id={`reason-${task.slot}`} className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} />
      <span className="small muted">{t('teacher.t12.stillSays')}</span>
      <div className="row">
        <button type="button" className="btn secondary sm" disabled={!reason.trim() || accept.isPending} onClick={() => accept.mutate()}>{t('teacher.t12.saveDecision')}</button>
        <Link to="/t/lessons/$id/tasks/$slot" params={{ id: lessonId, slot: task.slot }} className="lnk">{t('teacher.t12.fix')}</Link>
      </div>
    </div>
  );
}

export function ApprovePage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const approval = useQuery({ queryKey: qk.approval(id), queryFn: () => getApproval(id) });

  const approve = useMutation({
    mutationFn: (task: Task) => approveTask(id, task.slot as Slot, { expectedDraftVersion: task.draftVersion, previewHash: task.previewHash, candidateSetVersion: task.candidateSetVersion, confirmed: true }, newKey()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.approval(id) }),
  });

  if (!approval.data) return <p className="muted">{t(approval.isError ? 'errors.generic' : 'common.loading')}</p>;
  const { tasks } = approval.data;
  const approved = tasks.filter((x) => x.approvedAt).length;
  const allApproved = approved === tasks.length;

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t12.title')}</span>
      </nav>
      <Stepper current={4} />
      <div className="row">
        <h1 className="h1">{t('teacher.t12.title')}</h1>
        <StatusTag kind="teacher">{t('teacher.t12.tag')}</StatusTag>
      </div>
      <p className="lede">{t('teacher.t12.lede')}</p>
      {approve.isError ? <Note kind="err">{t(errorKey(approve.error instanceof ApiError ? approve.error.code : ''))}</Note> : null}
      <div className="card flush">
        <div className="row p-4">
          <h3 className="s15 b">{t('teacher.t06.count')}</h3>
          <span className="sp" />
          <span className="s13 sec num">{t('teacher.t12.approved', { count: approved })}</span>
        </div>
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('student.result.task')}</th>
                <th>{t('teacher.t12.results')}</th>
                <th>{t('teacher.t12.preview')}</th>
                <th>{t('teacher.t12.approval')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.slot}>
                  <td className="b">{t(`teacher.taskType.${task.slot}`)}</td>
                  <td>
                    <div className="stack">
                      <TaskStatusTag status={task.status} />
                      {task.acceptedWarning ? <StatusTag kind="teacher">{t('teacher.t12.decided')}</StatusTag> : null}
                      {task.decisionsNeeded.map((finding) => (
                        <Decision key={`${finding.gateId}-${finding.findingCode}`} lessonId={id} task={task} finding={finding} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="small num">{t('teacher.t07.version', { version: task.draftVersion })}</div>
                    <Link to="/t/lessons/$id/tasks/$slot" params={{ id, slot: task.slot }} className="lnk">{t('teacher.t12.view')}</Link>
                  </td>
                  <td>
                    {task.approvedAt ? (
                      <StatusTag kind="teacher">{task.releaseLabel}</StatusTag>
                    ) : (
                      <button type="button" className="btn primary sm" disabled={task.decisionsNeeded.length > 0 || approve.isPending} onClick={() => approve.mutate(task)}>{t('teacher.t12.approve')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="row">
        <span className="sp" />
        {allApproved ? <Link to="/t/lessons/$id/assign" params={{ id }} className="btn primary">{t('teacher.t13.title')}</Link> : <button type="button" className="btn primary" disabled>{t('teacher.t13.title')}</button>}
      </div>
    </>
  );
}
