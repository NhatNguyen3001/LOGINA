import type { Slot, TeacherTaskPreviewDTO, TeacherTaskSummaryDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorShell } from '@/components/logina/EditorShell';
import { LimitNote } from '@/components/logina/LimitNote';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { SwitchSide } from '@/components/logina/SwitchSide';
import { errorKey } from '@/i18n';
import { ApiError, getChallenges, getLesson, getPreview, getTasks, newKey, rerunTask, sendEdit, tryCase } from '@/lib/api';
import { limitState, minutesUntil, useLimit } from '@/lib/limits';
import { qk, useJobPolling } from '@/lib/query';
import { TaskStatusTag } from './task-status';

const GATE_KIND = { PASS: 'pass', REVIEW_REQUIRED: 'review', BLOCKER: 'block' } as const;
const RECHECKING = ['VALIDATING', 'GENERATING', 'STALE'];

function Gates({ gates }: { gates: TeacherTaskPreviewDTO['gates'] }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <span className="small b sec">{t('teacher.t07.gates')}</span>
      {gates.map((gate) => (
        <div key={gate.gateId} className="qg">
          <span className="id">{gate.gateId}</span>
          <div className="stack">
            <StatusTag kind={GATE_KIND[gate.status]}>{t(`teacher.gate.${gate.status}`)}</StatusTag>
            <span className="s13 sec">{gate.explanationForTeacher}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PromptEditor({ lessonId, draftId, draftVersion, challengeId, message, onClose }: { lessonId: string; draftId: string; draftVersion: number; challengeId: string; message: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(message);
  const save = useMutation({
    mutationFn: () => sendEdit(lessonId, { editScope: 'LOGIC', targetType: 'challenge', targetId: draftId, changedRefs: [challengeId], baseVersion: draftVersion, payload: { challengeId, message: value } }, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      onClose();
    },
  });
  return (
    <div className="stack">
      <label className="s13 b" htmlFor={`prompt-${challengeId}`}>{t('teacher.t07.editPrompt', { label: challengeId })}</label>
      <textarea id={`prompt-${challengeId}`} className="textarea" value={value} onChange={(event) => setValue(event.target.value)} />
      <LimitNote action="AI_ACTION" />
      {save.isError ? <Note kind="err">{t(errorKey(save.error instanceof ApiError ? save.error.code : ''))}</Note> : null}
      <div className="row">
        <button type="button" className="btn primary sm" disabled={!value.trim() || value === message || save.isPending} onClick={() => save.mutate()}>{t('teacher.t07.saveRecheck')}</button>
        <button type="button" className="btn secondary sm" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

/** A blocked task opens this list at once: it is where Open to fix on T12 leads. */
function AllPrompts({ lessonId, slot, draftId, draftVersion, status }: { lessonId: string; slot: Slot; draftId: string; draftVersion: number; status: string }) {
  const { t } = useTranslation();
  const blocked = status === 'BLOCKED';
  const [open, setOpen] = useState(blocked);
  const [editing, setEditing] = useState<string | null>(null);
  const list = useQuery({ queryKey: qk.challenges(lessonId, slot), queryFn: () => getChallenges(lessonId, slot), enabled: open });
  return (
    <>
      <button type="button" className="lnk jump self-start" aria-expanded={open} onClick={() => setOpen(!open)}>{t('teacher.t07.viewAll')}</button>
      {open
        ? list.data?.challenges.map((challenge) => (
            <div key={challenge.challengeId} className={`cand ${challenge.isFallback ? 'fb' : ''}`}>
              <div className="row">
                <span className="tag info">{challenge.label}</span>
                <span className="s13 b">{challenge.purpose}</span>
                <span className="sp" />
                {blocked && !challenge.isFallback ? <button type="button" className="btn secondary sm" onClick={() => setEditing(challenge.challengeId)}>{t('teacher.t07.editPrompt', { label: challenge.label })}</button> : null}
              </div>
              {editing === challenge.challengeId ? (
                <PromptEditor lessonId={lessonId} draftId={draftId} draftVersion={draftVersion} challengeId={challenge.challengeId} message={challenge.message} onClose={() => setEditing(null)} />
              ) : (
                <p className="msg">{challenge.message}</p>
              )}
              <span className="small muted">{challenge.whenShown}</span>
            </div>
          ))
        : null}
    </>
  );
}

function SummaryBody({ preview }: { preview: TeacherTaskSummaryDTO }) {
  const { t } = useTranslation();
  const labels = preview.taskBody.teacherLabels;
  const items: { id: string; text: string }[] =
    preview.slot === 'Q2'
      ? preview.taskBody.cards.map((c) => ({ id: c.cardId, text: c.text }))
      : preview.slot === 'Q3'
        ? [...preview.taskBody.options.map((o) => ({ id: o.optionId, text: o.text })), ...preview.taskBody.criteria.map((c) => ({ id: c.criterionId, text: c.text }))]
        : preview.slot === 'Q4'
          ? preview.taskBody.templates.map((x) => ({ id: x.templateId, text: x.text }))
          : [];
  return (
    <>
      {preview.slot === 'Q5' ? <p className="s15">{preview.taskBody.instructions}</p> : null}
      {items.map(({ id, text }) => (
        <div key={id} className="opt">
          <span className="k">{id}</span>
          <div>
            <div className="m">{text}</div>
            {labels[id] ? <div className="meta"><span className="tag neutral">{labels[id]}</span></div> : null}
          </div>
          <span />
        </div>
      ))}
      <p className="small muted">{t('teacher.t07.readOnly')}</p>
    </>
  );
}

function TryCase({ lessonId, slot, preview }: { lessonId: string; slot: Slot; preview: TeacherTaskPreviewDTO }) {
  const { t } = useTranslation();
  const [answerId, setAnswerId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const run = useMutation({ mutationFn: () => tryCase(lessonId, slot, { answerId, evidenceId }, newKey()) });
  return (
    <div className="card b-navy">
      <div className="row">
        <h3 className="s15 b">{t('teacher.t07.tryCase')}</h3>
        <span className="sp" />
        <span className="s13 muted">{t('teacher.t07.tryHint')}</span>
      </div>
      <div className="row">
        <span className="small b sec">{t('teacher.t07.statement')}</span>
        {preview.answers.map(({ id }) => (
          <button key={id} type="button" className={`chip ${answerId === id ? 'on' : ''}`} aria-pressed={answerId === id} onClick={() => setAnswerId(id)}>{id}</button>
        ))}
      </div>
      <div className="row">
        <span className="small b sec">{t('teacher.t07.card')}</span>
        {preview.evidence.map(({ id }) => (
          <button key={id} type="button" className={`chip ${evidenceId === id ? 'on' : ''}`} aria-pressed={evidenceId === id} onClick={() => setEvidenceId(id)}>{id}</button>
        ))}
        <span className="sp" />
        <button type="button" className="btn secondary sm" disabled={!answerId || !evidenceId || run.isPending} onClick={() => run.mutate()}>{t('teacher.t07.tryRun')}</button>
      </div>
      {run.data ? (
        <div className="well stack">
          <div className="row">
            <span className="s13 sec">{t('teacher.t07.willGet')}</span>
            <span className="tag info">{run.data.wouldReceive.label}</span>
            <span className="s13 b">{run.data.wouldReceive.purpose}</span>
          </div>
          <p className="s15 m">{run.data.wouldReceive.message}</p>
        </div>
      ) : null}
      <p className="small muted">{t('teacher.t07.tryNote')}</p>
    </div>
  );
}

function QuickEdit({ lessonId, preview, optionId, text, onClose }: { lessonId: string; preview: TeacherTaskPreviewDTO; optionId: string; text: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(text);
  const key = useRef(newKey());
  const limit = useLimit('AI_ACTION');
  const blocked = limit ? limitState(limit) === 'reached' : false;

  const save = useMutation({
    mutationFn: () => sendEdit(lessonId, { editScope: 'CONTENT', targetType: 'answerOption', targetId: preview.draftId, changedRefs: [optionId], baseVersion: preview.draftVersion, payload: { optionId, text: value } }, key.current),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      onClose();
    },
    onError: () => {
      key.current = newKey();
      return queryClient.invalidateQueries({ queryKey: qk.limits() });
    },
  });

  const code = save.error instanceof ApiError ? save.error.code : '';
  const refused = code === 'NEEDS_SOURCE_ROUTE';
  const conflict = code === 'VERSION_CONFLICT' || code === 'STALE_VERSION';

  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
    onClose();
  };

  return (
    <div className="stack">
      <label className="vh" htmlFor={`edit-${optionId}`}>{t('teacher.t07.quickEdit', { option: optionId })}</label>
      <textarea id={`edit-${optionId}`} className="textarea" value={value} onChange={(event) => setValue(event.target.value)} />
      <LimitNote action="AI_ACTION" />
      {refused ? (
        <div className="card b-red">
          <StatusTag kind="block">{t('teacher.t11.refusedTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.refused')}</p>
          <div className="row">
            <button type="button" className="btn secondary sm" onClick={() => save.reset()}>{t('teacher.t11.keepWording')}</button>
            <Link to="/t/lessons/$id/source/edit" params={{ id: lessonId }} className="btn secondary sm">{t('teacher.t11.editSource')}</Link>
            <button type="button" className="btn secondary sm" onClick={onClose}>{t('teacher.t11.revert')}</button>
          </div>
        </div>
      ) : null}
      {conflict ? (
        <div className="card b-orange">
          <StatusTag kind="review">{t('teacher.t11.conflictTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.conflict')}</p>
          <div className="row">
            <button type="button" className="btn primary sm" onClick={() => void reload()}>{t('teacher.t11.openNew')}</button>
            <button type="button" className="btn secondary sm" onClick={() => void navigator.clipboard.writeText(value)}>{t('teacher.t11.copy')}</button>
          </div>
        </div>
      ) : null}
      {save.isError && !refused && !conflict && code !== 'RATE_LIMITED' ? <Note kind="err">{t(errorKey(code))}</Note> : null}
      <div className="row">
        <button type="button" className="btn primary sm" disabled={blocked || !value.trim() || value === text || save.isPending} onClick={() => save.mutate()}>
          {blocked && limit ? t('limits.wait', { minutes: minutesUntil(limit.resetsAt) }) : t('teacher.t07.saveRecheck')}
        </button>
        <button type="button" className="btn secondary sm" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

function Q1Body({ lessonId, preview }: { lessonId: string; preview: TeacherTaskPreviewDTO }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const locked = RECHECKING.includes(preview.status);
  return (
    <>
      <div className="sec-h"><h3>{t('teacher.t07.statements', { count: preview.answers.length })}</h3></div>
      {preview.answers.map((answer) => (
        <div key={answer.id} className={`opt ${answer.inlineFinding ? 'warn' : ''} ${editing === answer.id ? 'edited' : ''}`}>
          <span className="k">{answer.id}</span>
          <div>
            {editing === answer.id ? (
              <QuickEdit lessonId={lessonId} preview={preview} optionId={answer.id} text={answer.text} onClose={() => setEditing(null)} />
            ) : (
              <div className="m">{answer.text}</div>
            )}
            <div className="meta">
              <span className="tag neutral">{answer.teacherLabel}</span>
              <span className="src">{answer.sourceAnchor}</span>
            </div>
            {answer.inlineFinding ? (
              <div className="inline-find">
                <StatusTag kind="review">{answer.inlineFinding.gateId}</StatusTag>
                <span>{answer.inlineFinding.explanationForTeacher}</span>
              </div>
            ) : null}
          </div>
          <div className="acts">
            <button type="button" className="ibtn" aria-label={t('teacher.t07.quickEdit', { option: answer.id })} disabled={locked} onClick={() => setEditing(answer.id)}>
              <Pencil className="ico" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      <div className="sec-h"><h3>{t('teacher.t07.cards', { count: preview.evidence.length })}</h3></div>
      {preview.evidence.map((card) => (
        <div key={card.id} className="opt">
          <span className="k">{card.id}</span>
          <div>
            <div className="m">{card.text}</div>
            <div className="meta">
              <span className="tag neutral">{card.teacherLabel}</span>
              <span className="s13 sec">{card.relationNote}</span>
              <span className="src">{card.sourceAnchor}</span>
            </div>
          </div>
          <span />
        </div>
      ))}
    </>
  );
}

export function PreviewPage() {
  const { t } = useTranslation();
  const { id, slot } = useParams({ strict: false }) as { id: string; slot: Slot };
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const tasks = useQuery({ queryKey: qk.tasks(id), queryFn: () => getTasks(id) });
  const preview = useQuery({ queryKey: qk.preview(id, slot), queryFn: () => getPreview(id, slot) });
  const job = useJobPolling(lesson.data?.activeJobId);
  const jobStatus = job.data?.status;

  useEffect(() => {
    if (jobStatus && ['DONE', 'FAILED', 'TIMED_OUT'].includes(jobStatus)) void queryClient.invalidateQueries({ queryKey: ['lesson', id] });
  }, [id, jobStatus, queryClient]);

  const rerun = useMutation({
    mutationFn: () => rerunTask(id, slot, newKey()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lesson', id] }),
  });

  const data = preview.data;
  const remaining = tasks.data?.slots.filter((s) => s.draftStatus !== 'MACHINE_PASS' && s.draftStatus !== 'APPROVED').length ?? 0;
  const rechecking = data ? RECHECKING.includes(data.status) : false;
  const failed = data?.status === 'FAILED';

  const header = (
    <>
      <Link to="/t/lessons/$id/tasks" params={{ id }} className="btn secondary sm" aria-label={t('teacher.t06.title')}><ArrowLeft className="ico" aria-hidden="true" /></Link>
      <span className="b s15">{lesson.data?.title}</span>
      <span className="sp" />
      {slot === 'Q1' ? <Link to="/t/lessons/$id/tasks/$slot/logic" params={{ id, slot }} className="btn secondary sm">{t('teacher.t08.title')}</Link> : null}
      <Link to="/t/lessons/$id/approve" params={{ id }} className="btn secondary sm">
        {t('teacher.goApproval')}
        {remaining > 0 ? <span className="cnt">{remaining}</span> : null}
      </Link>
      <SwitchSide to="student" lessonId={id} />
    </>
  );

  const taskList = (
    <>
      <span className="small b muted">{t('common.tasks')}</span>
      {tasks.data?.slots.map((item) => (
        <Link key={item.slot} to="/t/lessons/$id/tasks/$slot" params={{ id, slot: item.slot }} className={`tk no-underline ${item.slot === slot ? 'on' : ''}`}>
          <span className="q">{t(`teacher.taskType.${item.slot}`)}</span>
          <span className="self-start"><TaskStatusTag status={item.draftStatus} /></span>
        </Link>
      ))}
    </>
  );

  const side = data ? (
    <>
      <div className="row">
        <h3 className="b">{t('teacher.t07.checks', { slot })}</h3>
        <span className="sp" />
        <TaskStatusTag status={data.status} />
      </div>
      {'structureChecks' in data ? (
        <div className="well stack">
          <span className="small b sec">{t('teacher.t07.structure')}</span>
          {data.structureChecks.map((check) => (
            <div key={check.label} className="row">
              <span className={check.status === 'PASS' ? 'ok' : 'no'}>{check.status === 'PASS' ? '✓' : '✕'}</span>
              <span className="s13">{check.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <Gates gates={data.gates} />
    </>
  ) : null;

  return (
    <EditorShell header={header} stepper={<Stepper current={3} />} taskList={taskList} side={side}>
      {!data ? preview.isError ? <p className="muted">{t('errors.generic')}</p> : <LoadingSkeleton /> : null}
      {rechecking ? (
        <Note kind="info">
          <p className="b">{t('teacher.t09.title')}</p>
          <p>{t('teacher.t09.body')}</p>
        </Note>
      ) : null}
      {failed ? (
        <div className="card b-red">
          <StatusTag kind="block">{t('teacher.t11.failedTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.failed')}</p>
          <div className="row">
            <span className="tag stale">{t('teacher.t11.cantApprove', { slot })}</span>
            <span className="sp" />
            <button type="button" className="btn primary sm" disabled={rerun.isPending} onClick={() => rerun.mutate()}>{t('common.retry')}</button>
          </div>
        </div>
      ) : null}
      {data ? (
        <>
          <div className="row">
            <h2 className="bb">{t(`teacher.taskType.${slot}`)}</h2>
            <span className="sp" />
            <span className="s13 muted num">{t('teacher.t07.version', { version: data.draftVersion })}</span>
          </div>
          <div className="card tight">
            <span className="small b sec">{t('teacher.t07.question')}</span>
            <p className="s15 m">{data.questionStem}</p>
          </div>
          {'answers' in data ? <Q1Body lessonId={id} preview={data} /> : <SummaryBody preview={data} />}
          <div className="sec-h">
            <h3>{t('teacher.t07.thinkAgain')}</h3>
            <span className="s13 muted">{t('teacher.t07.oneEach')}</span>
          </div>
          {data.exampleChallenges.map((challenge) => (
            <div key={challenge.label} className="cand">
              <div className="row">
                <span className="tag info">{challenge.label}</span>
                <span className="s13 b">{challenge.purpose}</span>
                <span className="sp" />
                <span className="small muted">{challenge.whenShown}</span>
              </div>
              <p className="msg">{challenge.message}</p>
            </div>
          ))}
          <AllPrompts key={data.draftVersion} lessonId={id} slot={slot} draftId={data.draftId} draftVersion={data.draftVersion} status={data.status} />
          {'answers' in data ? <TryCase lessonId={id} slot={slot} preview={data} /> : null}
        </>
      ) : null}
    </EditorShell>
  );
}
