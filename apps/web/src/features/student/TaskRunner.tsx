import type { Artifact, DraftArtifact, Phase, Q2Artifact, Q2TaskBody, Q3Artifact, Q3TaskBody, Q4Artifact, Q4TaskBody, Q5Artifact, Slot, StudentChallengeDTO, StudentTaskDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Lock, Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BusyNote } from '@/components/logina/BusyNote';
import { ConfidenceSlider, DEFAULT_CONFIDENCE } from '@/components/logina/ConfidenceSlider';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { ResetRun } from '@/components/logina/ResetRun';
import { SaveStatus } from '@/components/logina/SaveStatus';
import { StatusTag } from '@/components/logina/StatusTag';
import { StickyActionBar } from '@/components/logina/StickyActionBar';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { StudentShell } from '@/components/logina/StudentShell';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { ApiError, getChallenge, getStudentTask, lockTask, newKey, saveDraft, submitTask } from '@/lib/api';
import { qk } from '@/lib/query';
import { errorKey } from '@/i18n';
import { ArtifactEditor, emptyDraft, isComplete, missingKey, sameArtifact } from './editors';
import { useAutosave } from './use-autosave';
import { useLessonTitle } from './use-lesson-title';

const SLOTS: Slot[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

const progressFor = (current: Slot, submitted: Slot[]) =>
  SLOTS.map((slot) => ({ slot, state: slot === current ? ('on' as const) : submitted.includes(slot) ? ('done' as const) : ('todo' as const) }));

/** The one action of a step stays in reach on a long page, with why it is waiting beside it. */
function TaskActions({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <StickyActionBar>
      <div className="row">
        <div className="grow stack dock-note">{note}</div>
        {children}
      </div>
    </StickyActionBar>
  );
}

function errorText(error: unknown): string {
  return errorKey(error instanceof ApiError ? error.code : '');
}

function LockedAnswer({ summary }: { summary: StudentChallengeDTO['lockedSummary'] }) {
  const { t } = useTranslation();
  return (
    <dl className="ans">
      <div className="ln">
        <dt>{t(summary.evidenceText ? 'student.think.statement' : 'student.think.answer')}</dt>
        <dd>{summary.answerText}</dd>
      </div>
      {summary.evidenceText ? (
        <div className="ln">
          <dt>{t('student.think.card')}</dt>
          <dd>{summary.evidenceText}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function LockedQ2({ body, answer }: { body: Q2TaskBody; answer: Q2Artifact }) {
  return (
    <ol className="ans ranked">
      {answer.orderedCardIds.map((id, index) => (
        <li key={id}>
          <span className="k">{index + 1}</span>
          <span>{body.cards.find((card) => card.cardId === id)?.text}</span>
        </li>
      ))}
    </ol>
  );
}

function LockedQ3({ body, answer }: { body: Q3TaskBody; answer: Q3Artifact }) {
  const { t } = useTranslation();
  const optionText = (id: string | undefined) => body.options.find((option) => option.optionId === id)?.text;
  const accepted = body.constraints.filter((constraint) => answer.tradeOffIds.includes(constraint.tradeOffId));
  return (
    <dl className="ans stacked">
      {body.criteria.map(({ criterionId, text }) => (
        <div key={criterionId} className="ln">
          <dt>{text}</dt>
          <dd>{optionText(answer.comparisons.find((c) => c.criterionId === criterionId)?.value)}</dd>
        </div>
      ))}
      <div className="ln">
        <dt>{t('student.q3.decide')}</dt>
        <dd>{optionText(answer.judgmentOptionId)}</dd>
      </div>
      {accepted.length > 0 ? (
        <div className="ln">
          <dt>{t('student.q3.tradeOffs')}</dt>
          {accepted.map(({ tradeOffId, text }) => <dd key={tradeOffId}>{text}</dd>)}
        </div>
      ) : null}
    </dl>
  );
}

/** The finished sentence, with what the student picked standing out from the template's own words. */
function LockedQ4({ body, answer }: { body: Q4TaskBody; answer: Q4Artifact }) {
  const template = body.templates.find((x) => x.templateId === answer.templateId);
  const chosen = (slotId: string) => {
    const choiceId = answer.slots.find((x) => x.slotId === slotId)?.choiceId;
    return template?.slots.find((x) => x.slotId === slotId)?.choices.find((x) => x.choiceId === choiceId)?.text;
  };
  return (
    <p className="ans fills">
      {template?.text.split(/(\[[^\]]+\])/).map((part, index) => {
        const slotId = /^\[(.+)\]$/.exec(part)?.[1];
        return slotId ? <mark key={index}>{chosen(slotId) ?? part}</mark> : part;
      })}
    </p>
  );
}

function LockedQ5({ answer }: { answer: Q5Artifact }) {
  const { t } = useTranslation();
  return (
    <dl className="ans stacked">
      <div className="ln">
        <dt>{t('student.q5.proposal')}</dt>
        <dd>{answer.proposal}</dd>
      </div>
      <div className="ln">
        <dt>{t('student.q5.reason')}</dt>
        <dd>{answer.reason}</dd>
      </div>
    </dl>
  );
}

function Answering({ attemptId, task, onLocked, onPhase }: { attemptId: string; task: StudentTaskDTO; onLocked: () => void; onPhase: (phase: Phase) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftArtifact>(() => emptyDraft(task));
  const [locking, setLocking] = useState(false);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const lockKey = useRef(newKey());
  const lockSent = useRef(false);
  const saveState = useAutosave(draft, (draftArtifact) => saveDraft(attemptId, task.slot, { draftArtifact }));

  const lock = useMutation({
    mutationFn: () => lockTask(attemptId, task.slot, { artifact: draft as Artifact, initialConfidence: confidence }, lockKey.current),
    onSuccess: onLocked,
    onError: () => {
      lockSent.current = false;
    },
  });

  /** Two clicks can land before React disables the button. */
  const sendLock = () => {
    if (lockSent.current) return;
    lockSent.current = true;
    lock.mutate();
  };

  useEffect(() => onPhase(locking ? 'CONFIDENCE_1' : 'REASON'), [locking, onPhase]);

  const complete = isComplete(task, draft);
  const missing = missingKey(task, draft);
  const saveStatus = <SaveStatus state={saveState} />;

  if (locking) {
    return (
      <>
        <h1 className="stem">{t('student.lock.question')}</h1>
        <ConfidenceSlider value={confidence} onChange={setConfidence} />
        <p className="s13 sec">{t('student.lock.hint')}</p>
        <p className="s13 sec">{t('student.lock.note')}</p>
        {lock.isError ? <Note kind="err">{t(errorText(lock.error))}</Note> : null}
        <TaskActions note={saveStatus}>
          <button type="button" className="btn secondary" onClick={() => setLocking(false)}>{t('student.lock.back')}</button>
          <button type="button" className="btn primary" disabled={lock.isPending} onClick={sendLock}>{t('student.lock.button')}</button>
        </TaskActions>
      </>
    );
  }

  return (
    <>
      <h1 className="stem">{task.stem}</h1>
      <ArtifactEditor task={task} value={draft} onChange={setDraft} />
      <TaskActions note={<>{missing ? <span className="s13 sec">{t(missing)}</span> : null}{saveStatus}</>}>
        <button type="button" className="btn primary" disabled={!complete} onClick={() => setLocking(true)}>{t('student.continue')}</button>
      </TaskActions>
    </>
  );
}

function Reconsidering({ attemptId, task, onSubmitted, onPhase }: { attemptId: string; task: StudentTaskDTO; onSubmitted: (next: Slot | undefined) => void; onPhase: (phase: Phase) => void }) {
  const { t } = useTranslation();
  const original = task.initialArtifact!;
  const [choice, setChoice] = useState<'KEEP' | 'REVISE' | null>(null);
  const [revised, setRevised] = useState<DraftArtifact>(original);
  const [finalConfidence, setFinalConfidence] = useState(DEFAULT_CONFIDENCE);
  const submitKey = useRef(newKey());

  const challenge = useQuery({ queryKey: qk.challenge(attemptId, task.slot), queryFn: () => getChallenge(attemptId, task.slot) });

  useEffect(() => onPhase(choice === 'KEEP' ? 'CONFIDENCE_2' : choice === 'REVISE' ? 'RECONSIDER' : 'CHALLENGED'), [choice, onPhase]);

  const submit = useMutation({
    mutationFn: () =>
      submitTask(attemptId, task.slot, { choice: choice!, finalArtifact: (choice === 'KEEP' ? original : revised) as Artifact, finalConfidence }, submitKey.current),
    onSuccess: ({ nextSlot }) => onSubmitted(nextSlot),
  });

  if (!challenge.data) return <LoadingSkeleton />;
  const lockedAnswer =
    task.slot === 'Q2' && original.slot === 'Q2' ? <LockedQ2 body={task.taskBody} answer={original} />
    : task.slot === 'Q3' && original.slot === 'Q3' ? <LockedQ3 body={task.taskBody} answer={original} />
    : task.slot === 'Q4' && original.slot === 'Q4' ? <LockedQ4 body={task.taskBody} answer={original} />
    : task.slot === 'Q5' && original.slot === 'Q5' ? <LockedQ5 answer={original} />
    : <LockedAnswer summary={challenge.data.lockedSummary} />;
  const submitLabel = t('student.submit', { slot: task.slot });
  const failure = submit.isError ? <Note kind="err">{t(errorText(submit.error))}</Note> : null;

  if (choice === 'KEEP') {
    return (
      <>
        <div className="row">
          <h1 className="stem grow">{t('student.final.keepTitle')}</h1>
          <StatusTag kind="neutral">{t('student.final.readOnly')}</StatusTag>
        </div>
        <div className="card">
          <div className="row">
            <StatusTag kind="neutral">{t('student.final.unchanged')}</StatusTag>
            <span className="sp" />
            <button type="button" className="btn choice sm" onClick={() => setChoice('REVISE')}>
              <Pencil className="ico" aria-hidden="true" />
              {t('student.final.changeMind')}
            </button>
          </div>
          {lockedAnswer}
        </div>
        <div className="card tight">
          <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
          <span className="s13 sec">{t('student.final.confidenceNote')}</span>
        </div>
        {failure}
        <TaskActions>
          <button type="button" className="btn primary" disabled={submit.isPending} onClick={() => submit.mutate()}>{submitLabel}</button>
        </TaskActions>
      </>
    );
  }

  if (choice === 'REVISE') {
    const unchanged = sameArtifact(revised, original);
    const ready = isComplete(task, revised);
    const missing = missingKey(task, revised);
    return (
      <>
        <h1 className="stem">{t('student.final.reviseTitle')}</h1>
        <ArtifactEditor task={task} value={revised} onChange={setRevised} original={original} />
        {unchanged ? <Note kind="info">{t('student.final.sameAsFirst')}</Note> : <Note kind="info">{t('student.final.onlyRevision', { slot: task.slot })}</Note>}
        <div className="card tight">
          <span className="b">{t('student.final.confidence')}</span>
          <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
        </div>
        {failure}
        <TaskActions note={missing ? <span className="s13 sec">{t(missing)}</span> : null}>
          <button type="button" className="btn primary" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>{submitLabel}</button>
        </TaskActions>
      </>
    );
  }

  return (
    <>
      <div className="stack">
        <span className="small b muted">{t('student.think.locked')}</span>
        {lockedAnswer}
        <span className="small muted">{t('student.think.stays')}</span>
      </div>
      <div className="bubble-tn">
        <span className="small b text-navy">{t('student.think.title')}</span>
        <p className="say">{challenge.data.message}</p>
        <span className="s13 muted">{t('student.think.note')}</span>
      </div>
      <h2 className="s15 b">{t('student.think.question')}</h2>
      <div className="egrid">
        <button type="button" className="btn choice" onClick={() => setChoice('REVISE')}>
          <Pencil className="ico" aria-hidden="true" />
          {t('student.revise')}
        </button>
        <button type="button" className="btn choice" onClick={() => setChoice('KEEP')}>
          <Lock className="ico" aria-hidden="true" />
          {t('student.keep')}
        </button>
      </div>
    </>
  );
}

export function TaskRunner() {
  const { t } = useTranslation();
  const { id: attemptId, slot } = useParams({ strict: false }) as { id: string; slot: Slot };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useSessionLocale();

  const task = useQuery({ queryKey: qk.attemptTask(attemptId, slot), queryFn: () => getStudentTask(attemptId, slot) });
  const lesson = useLessonTitle(attemptId);
  const [stepPhase, setStepPhase] = useState<Phase>('REASON');

  const onSubmitted = (next: Slot | undefined) => {
    if (next) void navigate({ to: '/s/attempts/$id/$slot', params: { id: attemptId, slot: next } });
    else void navigate({ to: '/s/attempts/$id/results', params: { id: attemptId } });
  };

  if (task.isError) {
    return (
      <StudentShell title={t('student.goneAfterReset')}>
        <Link to="/s/assignments" className="btn primary">{t('student.openNewSet')}</Link>
      </StudentShell>
    );
  }

  const nextAfter = SLOTS[SLOTS.indexOf(slot) + 1];

  return (
    <StudentShell lesson={lesson} current={t(`student.progress.${slot}`)} progress={<StudentProgress slots={progressFor(slot, task.data?.submittedSlots ?? [])} phase={task.data?.phase === 'SUBMITTED' ? 'SUBMITTED' : stepPhase} />} reset={<ResetRun attemptId={attemptId} />}>
      <BusyNote side="student" />
      {!task.data ? <LoadingSkeleton /> : null}
      {task.data?.phase === 'SUBMITTED' ? (
        <button type="button" className="btn primary" onClick={() => onSubmitted(nextAfter)}>{t('student.continue')}</button>
      ) : null}
      {task.data && task.data.phase !== 'SUBMITTED' && !task.data.initialArtifact ? (
        <Answering key={slot} attemptId={attemptId} task={task.data} onLocked={() => void queryClient.invalidateQueries({ queryKey: qk.attemptTask(attemptId, slot) })} onPhase={setStepPhase} />
      ) : null}
      {task.data && task.data.phase !== 'SUBMITTED' && task.data.initialArtifact ? <Reconsidering key={slot} attemptId={attemptId} task={task.data} onSubmitted={onSubmitted} onPhase={setStepPhase} /> : null}
    </StudentShell>
  );
}
