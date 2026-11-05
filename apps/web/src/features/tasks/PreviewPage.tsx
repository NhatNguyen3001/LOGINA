import { useUnsavedText } from '@/lib/unsaved';
import { readableSourceRefs } from '@/lib/source-refs';
import { TaskName } from '@/components/logina/TaskName';
import type { Slot, TeacherTaskPreviewDTO, TeacherTaskSummaryDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, CircleCheck, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { asStudentSees, optionLetter, plainTeacherText, promptName, splitLabel } from '@/lib/prompt-name';
import { EditorShell } from '@/components/logina/EditorShell';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { SwitchSide } from '@/components/logina/SwitchSide';
import { ApiError, getChallenges, getLesson, getPreview, getTasks, newKey, rerunTask, sendEdit, tryCase } from '@/lib/api';
import { useSamplePrefill } from '@/lib/sample-prefill';
import { qk, useJobPolling } from '@/lib/query';
import { TaskStatusTag } from './task-status';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { errorText } from '@/lib/errors';

const GATE_KIND = { PASS: 'pass', REVIEW_REQUIRED: 'review', BLOCKER: 'block' } as const;
const RECHECKING = ['VALIDATING', 'GENERATING', 'STALE'];

type Gate = TeacherTaskPreviewDTO['gates'][number];

function GateRow({ gate }: { gate: Gate }) {
  const { t } = useTranslation();
  return (
    <li className="check-row">
      <div className="row">
        <span className="s13 b">{t(`teacher.gateName.${gate.gateId}`)}</span>
        <span className="sp" />
        <StatusTag kind={GATE_KIND[gate.status]}>{t(`teacher.gate.${gate.status}`)}</StatusTag>
      </div>
      <p className="s13 sec">{plainTeacherText(gate.explanationForTeacher, t)}</p>
    </li>
  );
}

/** One line says where the task stands; only a check that needs the teacher is spelled out, the rest fold away. */
function Checks({ gates, structure }: { gates: Gate[]; structure: { label: string; status: string }[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState('');
  const flagged = gates.filter((gate) => gate.status !== 'PASS');
  return (
    <div className="stack">
      {flagged.length === 0 ? (
        <p className="checks-ok"><CircleCheck className="ico" aria-hidden="true" />{t('teacher.t07.allPassed')}</p>
      ) : (
        <>
          <p className="s15 b">{t('teacher.t07.needReview', { count: flagged.length })}</p>
          <ul className="check-list">{flagged.map((gate) => <GateRow key={gate.gateId} gate={gate} />)}</ul>
        </>
      )}
      <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
        <AccordionItem value="all" className="border-0 bg-transparent">
          <AccordionTrigger className="min-h-0 flex-none justify-start gap-1.5 px-0 py-1 text-sm text-accent-ink hover:bg-transparent hover:underline">{t(open ? 'teacher.t07.hideAll' : 'teacher.t07.showAll')}</AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
            {open ? (
              <>
                {structure.length > 0 ? (
                  <ul className="check-list">
                    {structure.map((check) => (
                      <li key={check.label} className="row">
                        <span className={check.status === 'PASS' ? 'ok' : 'no'}>{check.status === 'PASS' ? '✓' : '✕'}</span>
                        <span className="s13">{check.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ul className="check-list">{gates.map((gate) => <GateRow key={gate.gateId} gate={gate} />)}</ul>
              </>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function PromptEditor({ lessonId, draftId, draftVersion, challengeId, message, onClose }: { lessonId: string; draftId: string; draftVersion: number; challengeId: string; message: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /** The sample's blocked prompt starts with the scripted fix; typing replaces it. */
  const sampleText = useSamplePrefill(lessonId)?.promptText[challengeId];
  const [typed, setValue] = useState<string | null>(null);
  const value = typed ?? sampleText ?? message;
  useUnsavedText(typed !== null && typed !== message);
  const save = useMutation({
    mutationFn: () => sendEdit(lessonId, { editScope: 'LOGIC', targetType: 'challenge', targetId: draftId, changedRefs: [challengeId], baseVersion: draftVersion, payload: { challengeId, message: value } }, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      onClose();
    },
  });
  return (
    <div className="stack">
      <label className="s13 b" htmlFor={`prompt-${challengeId}`}>{t('teacher.t07.editPrompt', { label: promptName(challengeId, t) })}</label>
      <Textarea id={`prompt-${challengeId}`} value={value} onChange={(event) => setValue(event.target.value)} />
      {save.isError ? <Note kind="err">{t(errorText(save.error))}</Note> : null}
      <div className="row">
        <button type="button" className={buttonVariants({ size: 'sm' })} aria-busy={save.isPending} disabled={!value.trim() || value === message || save.isPending} onClick={() => save.mutate()}>{t('teacher.t07.saveRecheck')}</button>
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

type Example = TeacherTaskPreviewDTO['exampleChallenges'][number];

/** Every prompt once, the neutral one last. A blocked task can edit them here: it is where Open to fix on T12 leads. */
function PromptList({ lessonId, slot, draftId, draftVersion, status, examples }: { lessonId: string; slot: Slot; draftId: string; draftVersion: number; status: string; examples: Example[] }) {
  const { t } = useTranslation();
  const blocked = status === 'BLOCKED';
  const [editing, setEditing] = useState<string | null>(null);
  const list = useQuery({ queryKey: qk.challenges(lessonId, slot), queryFn: () => getChallenges(lessonId, slot) });
  const prompts = list.data
    ? [...list.data.challenges].sort((a, b) => Number(a.isFallback) - Number(b.isFallback))
    : examples.map((example) => ({ ...example, challengeId: example.label, isFallback: false }));
  return (
    <ol className="prompt-list">
      {prompts.map((challenge) => (
        <li key={challenge.challengeId} className={challenge.isFallback ? 'fb' : undefined}>
          <div className="row">
            <Badge kind={challenge.isFallback ? 'neutral' : 'info'}>{promptName(challenge.label, t)}</Badge>
            <span className="s13 b grow">{plainTeacherText(challenge.purpose, t)}</span>
            {blocked && !challenge.isFallback ? <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => setEditing(challenge.challengeId)}>{t('teacher.t07.editPrompt', { label: promptName(challenge.label, t) })}</button> : null}
          </div>
          {editing === challenge.challengeId ? (
            <PromptEditor lessonId={lessonId} draftId={draftId} draftVersion={draftVersion} challengeId={challenge.challengeId} message={challenge.message} onClose={() => setEditing(null)} />
          ) : (
            <p className="say">{asStudentSees(challenge.message)}</p>
          )}
          <span className="s13 muted">{plainTeacherText(challenge.whenShown, t)}</span>
        </li>
      ))}
    </ol>
  );
}

/** A label and its note, as a tag and plain words. */
function ItemMeta({ label, note, anchor }: { label?: string | undefined; note?: string | undefined; anchor?: string | undefined }) {
  const { t } = useTranslation();
  const { tag, note: rest } = splitLabel(label ?? '');
  const words = [rest, note].filter(Boolean).join(', ');
  if (!tag && !words && !anchor) return null;
  return (
    <div className="meta">
      {tag ? <Badge kind="neutral">{tag}</Badge> : null}
      {words ? <span className="s13 sec">{plainTeacherText(words, t)}</span> : null}
      {anchor ? <span className="src">{readableSourceRefs([anchor], t)}</span> : null}
    </div>
  );
}

function SummaryBody({ preview }: { preview: TeacherTaskSummaryDTO }) {
  const { t } = useTranslation();
  const labels = preview.taskBody.teacherLabels;
  const items: { id: string; text: string }[] =
    preview.slot === 'Q2'
      ? preview.taskBody.cards.map((c) => ({ id: c.cardId, text: c.text }))
      : preview.slot === 'Q3'
        ? [...preview.taskBody.options.map((o) => ({ id: o.optionId, text: o.text })), ...preview.taskBody.tradeOffs.flatMap((x) => [{ id: x.tradeOffId, text: x.text }, ...x.reasons.map((r) => ({ id: r.reasonId, text: r.text }))])]
        : preview.slot === 'Q4'
          ? [{ id: 'F', text: preview.taskBody.frame }, ...preview.taskBody.cards.map((x) => ({ id: x.cardId, text: x.text }))]
          : preview.taskBody.starters.map((x) => ({ id: x.starterId, text: x.text }));
  return (
    <>
      {preview.slot === 'Q5' ? <p className="s15">{preview.taskBody.instructions}</p> : null}
      <ul className="items">
        {items.map(({ id, text }) => (
          <li key={id} className="item">
            <span className="k">{id}</span>
            <div>
              <div className="m">{text}</div>
              <ItemMeta label={labels[id] === 'SUPPORTED' ? t('teacher.t07.supportedReason') : labels[id]} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function TryCase({ lessonId, slot, preview }: { lessonId: string; slot: Slot; preview: TeacherTaskPreviewDTO }) {
  const { t } = useTranslation();
  const [answerId, setAnswerId] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const run = useMutation({ mutationFn: () => tryCase(lessonId, slot, { answerId, evidenceId }, newKey()) });
  return (
    <div className={cardVariants()}>
      <div className="row">
        <h3 className="s15 b">{t('teacher.t07.tryCase')}</h3>
        <span className="sp" />
        <span className="s13 muted">{t('teacher.t07.tryHint')}</span>
      </div>
      <div className="row">
        <span className="small b sec">{t('teacher.t07.statement')}</span>
        {preview.answers.map(({ id }) => (
          <button key={id} type="button" className={`chip ${answerId === id ? 'on' : ''}`} aria-pressed={answerId === id} aria-label={t('teacher.t07.tryStatement', { letter: optionLetter(id) })} onClick={() => setAnswerId(id)}>{optionLetter(id)}</button>
        ))}
      </div>
      <div className="row">
        <span className="small b sec">{t('teacher.t07.card')}</span>
        {preview.evidence.map(({ id }) => (
          <button key={id} type="button" className={`chip ${evidenceId === id ? 'on' : ''}`} aria-pressed={evidenceId === id} aria-label={t('teacher.t07.tryCard', { letter: optionLetter(id) })} onClick={() => setEvidenceId(id)}>{optionLetter(id)}</button>
        ))}
        <span className="sp" />
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} aria-busy={run.isPending} disabled={!answerId || !evidenceId || run.isPending} onClick={() => run.mutate()}>{t('teacher.t07.tryRun')}</button>
      </div>
      {run.data ? (
        <div className="well stack">
          <div className="row">
            <span className="s13 sec">{t('teacher.t07.willGet')}</span>
            <Badge kind="info">{promptName(run.data.wouldReceive.label, t)}</Badge>
            <span className="s13 b">{run.data.wouldReceive.purpose}</span>
          </div>
          <p className="s15 m">{asStudentSees(run.data.wouldReceive.message)}</p>
        </div>
      ) : null}
      <p className="small muted">{t('teacher.t07.tryNote')}</p>
    </div>
  );
}

function QuickEdit({ lessonId, preview, optionId, text, onClose }: { lessonId: string; preview: TeacherTaskPreviewDTO; optionId: string; text: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /** The sample's A4 starts with the scripted rewording; typing replaces it. */
  const sampleText = useSamplePrefill(lessonId)?.optionText[optionId];
  const [typed, setValue] = useState<string | null>(null);
  const value = typed ?? sampleText ?? text;
  useUnsavedText(typed !== null && typed !== text);
  const key = useRef(newKey());

  const save = useMutation({
    mutationFn: () => sendEdit(lessonId, { editScope: 'CONTENT', targetType: 'answerOption', targetId: preview.draftId, changedRefs: [optionId], baseVersion: preview.draftVersion, payload: { optionId, text: value } }, key.current),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      onClose();
    },
    onError: () => {
      key.current = newKey();
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
      <label className="vh" htmlFor={`edit-${optionId}`}>{t('teacher.t07.quickEdit', { option: optionLetter(optionId) })}</label>
      <Textarea id={`edit-${optionId}`} value={value} onChange={(event) => setValue(event.target.value)} />
      {refused ? (
        <div className={cardVariants({ edge: 'red' })}>
          <StatusTag kind="block">{t('teacher.t11.refusedTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.refused')}</p>
          <div className="row">
            <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => save.reset()}>{t('teacher.t11.keepWording')}</button>
            <Link to="/t/lessons/$id/source/edit" params={{ id: lessonId }} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>{t('teacher.t11.editSource')}</Link>
            <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={onClose}>{t('teacher.t11.revert')}</button>
          </div>
        </div>
      ) : null}
      {conflict ? (
        <div className={cardVariants({ edge: 'orange' })}>
          <StatusTag kind="review">{t('teacher.t11.conflictTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.conflict')}</p>
          <div className="row">
            <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => void reload()}>{t('teacher.t11.openNew')}</button>
            <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => void navigator.clipboard.writeText(value)}>{t('teacher.t11.copy')}</button>
          </div>
        </div>
      ) : null}
      {save.isError && !refused && !conflict && code !== 'RATE_LIMITED' ? <Note kind="err">{t(errorText(save.error))}</Note> : null}
      <div className="row">
        <button type="button" className={buttonVariants({ size: 'sm' })} aria-busy={save.isPending} disabled={!value.trim() || value === text || save.isPending} onClick={() => save.mutate()}>{t('teacher.t07.saveRecheck')}</button>
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={onClose}>{t('common.cancel')}</button>
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
      <h3 className="s15 b">{t('teacher.t07.statements', { count: preview.answers.length })}</h3>
      <ul className="items">
        {preview.answers.map((answer) => (
          <li key={answer.id} className={`item ${answer.inlineFinding ? 'warn' : ''} ${editing === answer.id ? 'edited' : ''}`}>
            <span className="k">{optionLetter(answer.id)}</span>
            <div>
              {editing === answer.id ? (
                <QuickEdit lessonId={lessonId} preview={preview} optionId={answer.id} text={answer.text} onClose={() => setEditing(null)} />
              ) : (
                <div className="m">{answer.text}</div>
              )}
              <ItemMeta label={answer.teacherLabel} anchor={answer.sourceAnchor} />
              {answer.inlineFinding ? (
                <div className="inline-find">
                  <StatusTag kind="review">{t(`teacher.gateName.${answer.inlineFinding.gateId}`)}</StatusTag>
                  <span>{plainTeacherText(answer.inlineFinding.explanationForTeacher, t)}</span>
                </div>
              ) : null}
            </div>
            <div className="acts">
              <button type="button" className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label={t('teacher.t07.quickEdit', { option: optionLetter(answer.id) })} disabled={locked} onClick={() => setEditing(answer.id)}>
                <Pencil className="ico" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h3 className="s15 b">{t('teacher.t07.cards', { count: preview.evidence.length })}</h3>
      <ul className="items">
        {preview.evidence.map((card) => (
          <li key={card.id} className="item">
            <span className="k">{optionLetter(card.id)}</span>
            <div>
              <div className="m">{card.text}</div>
              <ItemMeta label={card.teacherLabel} note={card.relationNote} anchor={card.sourceAnchor} />
            </div>
          </li>
        ))}
      </ul>
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
      <Link to="/t/lessons/$id/tasks" params={{ id }} className={buttonVariants({ variant: 'secondary', size: 'sm' })} aria-label={t('teacher.t06.title')}><ArrowLeft className="ico" aria-hidden="true" /></Link>
      <span className="b s15">{lesson.data?.title}</span>
      <span className="sp" />
      {slot === 'Q1' ? <Link to="/t/lessons/$id/tasks/$slot/logic" params={{ id, slot }} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>{t('teacher.t08.title')}</Link> : null}
      <Link to="/t/lessons/$id/approve" params={{ id }} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
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
          <span className="q"><TaskName slot={item.slot} /></span>
          <span className="self-start"><TaskStatusTag status={item.draftStatus} /></span>
        </Link>
      ))}
    </>
  );

  const side = data ? (
    <>
      <h3 className="b">{t('teacher.t07.checksTitle')}</h3>
      <Checks gates={data.gates} structure={'structureChecks' in data ? data.structureChecks : []} />
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
        <div className={cardVariants({ edge: 'red' })}>
          <StatusTag kind="block">{t('teacher.t11.failedTitle')}</StatusTag>
          <p className="s15">{t('teacher.t11.failed')}</p>
          <div className="row">
            <Badge kind="stale">{t('teacher.t11.cantApprove', { slot })}</Badge>
            <span className="sp" />
            <button type="button" className={buttonVariants({ size: 'sm' })} aria-busy={rerun.isPending} disabled={rerun.isPending} onClick={() => rerun.mutate()}>{t('common.retry')}</button>
          </div>
        </div>
      ) : null}
      {data ? (
        <>
          <div className="task-main stack">
            <div className="row">
              <h2 className="task-title"><span className="q-chip">{slot}</span>{t(`teacher.taskType.${slot}`)}</h2>
              <span className="sp" />
              <TaskStatusTag status={data.status} />
            </div>
            <div className={cardVariants({ tone: 'tight' })}>
              <span className="small b sec">{t('teacher.t07.question')}</span>
              <p className="s15 m">{data.questionStem}</p>
            </div>
            {'answers' in data ? <Q1Body lessonId={id} preview={data} /> : <SummaryBody preview={data} />}
            <div className="stack gap-1">
              <h3 className="s15 b">{t('teacher.t07.thinkAgain')}</h3>
              <p className="s13 muted">{t('teacher.t07.oneEach')}</p>
            </div>
            <PromptList key={data.draftVersion} lessonId={id} slot={slot} draftId={data.draftId} draftVersion={data.draftVersion} status={data.status} examples={data.exampleChallenges} />
            {'answers' in data ? <TryCase lessonId={id} slot={slot} preview={data} /> : null}
          </div>
        </>
      ) : null}
    </EditorShell>
  );
}
