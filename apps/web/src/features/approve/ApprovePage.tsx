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

const blockingGates = (task: Task) => task.gatesSummary.gates.filter((gate) => gate.status === 'BLOCKER');

const BLOCKING_STATUS: Task['status'][] = ['GENERATING', 'VALIDATING', 'STALE', 'FAILED', 'BLOCKED'];

function ApprovePanel({ lessonId, task }: { lessonId: string; task: Task }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const approve = useMutation({
    mutationFn: () => approveTask(lessonId, task.slot as Slot, { expectedDraftVersion: task.draftVersion, previewHash: task.previewHash, candidateSetVersion: task.candidateSetVersion, confirmed: true }, newKey()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.approval(lessonId) }),
  });
  const blockers = blockingGates(task).length;
  const undecided = task.decisionsNeeded.filter((finding) => finding.overridable).length;
  const ready = blockers === 0 && undecided === 0 && !BLOCKING_STATUS.includes(task.status);

  return (
    <div className="card sticky">
      <div className="row">
        <h3 className="b">{t('teacher.t12.approveSlot', { slot: task.slot })}</h3>
        <span className="sp" />
        <span className="s13 muted num">{`v${task.draftVersion}`}</span>
      </div>
      {task.changesSinceLastPreview.length > 0 ? (
        <div className="well stack">
          <span className="small b sec">{t('teacher.t12.changes')}</span>
          {task.changesSinceLastPreview.map((change) => (
            <span key={change} className="s13">{t(`teacher.t12.change.${change}`, { defaultValue: t('teacher.t12.change.PREVIEW_CHANGED') })}</span>
          ))}
        </div>
      ) : null}
      <div className="stack">
        <div className="row"><span className={blockers === 0 ? 'ok' : 'no'}>{blockers === 0 ? '✓' : '✕'}</span><span>{t('teacher.t12.noBlockers')}</span></div>
        <div className="row"><span className={undecided === 0 ? 'ok' : 'wait'}>{undecided === 0 ? '✓' : '…'}</span><span>{t('teacher.t12.warningsDecided')}</span></div>
      </div>
      <label className="row top">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span className="s13 grow">{t('teacher.t12.confirm', { slot: task.slot })}</span>
      </label>
      {approve.isError ? <Note kind="err">{t(errorKey(approve.error instanceof ApiError ? approve.error.code : ''))}</Note> : null}
      <button type="button" className="btn primary block" disabled={!confirmed || !ready || approve.isPending} onClick={() => approve.mutate()}>{t('teacher.t12.approveSlot', { slot: task.slot })}</button>
    </div>
  );
}

export function ApprovePage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const approval = useQuery({ queryKey: qk.approval(id), queryFn: () => getApproval(id) });
  const [selected, setSelected] = useState<Slot | null>(null);

  if (!approval.data) return <p className="muted">{t(approval.isError ? 'errors.generic' : 'common.loading')}</p>;
  const { tasks } = approval.data;
  const approved = tasks.filter((x) => x.approvedAt).length;
  const allApproved = approved === tasks.length;
  const current = tasks.find((x) => !x.approvedAt && (selected === null || x.slot === selected)) ?? tasks.find((x) => !x.approvedAt);

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
      <div className="cols">
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
                      {blockingGates(task).map((gate) => (
                        <div key={gate.gateId} className="stack">
                          <span className="s13">{`${gate.gateId} · ${gate.explanationForTeacher}`}</span>
                          <Link to="/t/lessons/$id/tasks/$slot" params={{ id, slot: task.slot }} className="btn secondary sm self-start">{t('teacher.t12.openToFix')}</Link>
                        </div>
                      ))}
                      {task.decisionsNeeded.filter((finding) => finding.overridable).map((finding) => (
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
                      <button type="button" className="btn secondary sm" aria-pressed={current?.slot === task.slot} onClick={() => setSelected(task.slot)}>{t('teacher.t12.review', { slot: task.slot })}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {current ? <ApprovePanel key={`${current.slot}-${current.draftVersion}`} lessonId={id} task={current} /> : null}
      </div>
      <div className="row">
        <span className="sp" />
        {allApproved ? <Link to="/t/lessons/$id/assign" params={{ id }} className="btn primary">{t('teacher.t12.assignCount', { count: approved })}</Link> : <button type="button" className="btn primary" disabled>{t('teacher.t12.assignCount', { count: approved })}</button>}
      </div>
    </>
  );
}
