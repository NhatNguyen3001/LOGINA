import type { Artifact, DraftArtifact, Phase, Q2Artifact, Q2TaskBody, Q3Artifact, Q3TaskBody, Q5Artifact, Q5TaskBody, Slot, StudentChallengeDTO, StudentTaskDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BusyNote } from '@/components/logina/BusyNote';
import { ConfidenceSlider, DEFAULT_CONFIDENCE } from '@/components/logina/ConfidenceSlider';
import { LoadFailed } from '@/components/logina/LoadFailed';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { ResetRun } from '@/components/logina/ResetRun';
import { SaveStatus } from '@/components/logina/SaveStatus';
import { StickyActionBar } from '@/components/logina/StickyActionBar';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { StudentShell } from '@/components/logina/StudentShell';
import { useSessionLocale } from '@/lib/use-session-locale';
import { ApiError, getChallenge, getStudentTask, lockTask, newKey, saveDraft, submitTask } from '@/lib/api';
import { qk } from '@/lib/query';
import { ArtifactEditor, FilledFrame, describeChange, emptyDraft, isComplete, missingKey, sameArtifact } from './editors';
import { createTrace, type TaskTrace } from './use-task-trace';
import { useAutosave } from './use-autosave';
import { useLessonTitle } from './use-lesson-title';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { errorText } from '@/lib/errors';

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
  const tradeOff = body.tradeOffs.find((item) => item.tradeOffId === answer.tradeOffId);
  return (
    <dl className="ans stacked">
      <div className="ln">
        <dt>{t('student.q3.decide')}</dt>
        <dd>{body.options.find((option) => option.optionId === answer.judgmentOptionId)?.text}</dd>
      </div>
      <div className="ln">
        <dt>{t('student.q3.giveUp')}</dt>
        <dd>{tradeOff?.text}</dd>
      </div>
      <div className="ln">
        <dt>{t('student.q3.why')}</dt>
        <dd>{tradeOff?.reasons.find((reason) => reason.reasonId === answer.reasonId)?.text}</dd>
      </div>
    </dl>
  );
}

function LockedQ5({ body, answer }: { body: Q5TaskBody; answer: Q5Artifact }) {
  return (
    <dl className="ans stacked">
      {answer.answers.map(({ starterId, text }) => (
        <div key={starterId} className="ln">
          <dt>{body.starters.find((starter) => starter.starterId === starterId)?.text}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Answering({ attemptId, task, trace, onLocked, onPhase }: { attemptId: string; task: StudentTaskDTO; trace: TaskTrace; onLocked: (challenge: StudentChallengeDTO, answer: Artifact, confidence: number) => void; onPhase: (phase: Phase) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftArtifact>(() => emptyDraft(task));
  const [locking, setLocking] = useState(false);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const lockKey = useRef(newKey());
  const lockSent = useRef(false);
  const autosave = useAutosave(draft, (draftArtifact) => saveDraft(attemptId, task.slot, { draftArtifact }));

  const lock = useMutation({
    mutationFn: () => lockTask(attemptId, task.slot, { artifact: draft as Artifact, initialConfidence: confidence, secondsOnTask: trace.seconds(), answerChanges: trace.changes() }, lockKey.current),
    onSuccess: (challenge) => {
      trace.clearChanges();
      onLocked(challenge, draft as Artifact, confidence);
    },
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

  const change = (next: DraftArtifact) => {
    describeChange(task, draft, next).forEach(trace.record);
    setDraft(next);
  };

  const complete = isComplete(task, draft);
  const missing = missingKey(task, draft);
  const saveStatus = <SaveStatus save={autosave} />;

  if (locking) {
    return (
      <>
        <h1 className="stem" tabIndex={-1}>{t('student.lock.question')}</h1>
        <ConfidenceSlider value={confidence} onChange={setConfidence} />
        <p className="s13 sec">{t('student.lock.hint')}</p>
        <p className="s13 sec">{t('student.lock.note')}</p>
        {lock.isError ? <Note kind="err">{t(errorText(lock.error))}</Note> : null}
        <TaskActions note={saveStatus}>
          <button type="button" className={buttonVariants({ variant: 'secondary' })} onClick={() => setLocking(false)}>{t('student.lock.back')}</button>
          <button type="button" className={buttonVariants()} aria-busy={lock.isPending} disabled={lock.isPending} onClick={sendLock}>{t('student.lock.button')}</button>
        </TaskActions>
      </>
    );
  }

  return (
    <>
      <h1 className="stem" tabIndex={-1}>{task.stem}</h1>
      <ArtifactEditor task={task} value={draft} onChange={change} />
      <TaskActions note={<>{missing ? <span className="s13 sec">{t(missing)}</span> : null}{saveStatus}</>}>
        <button type="button" className={buttonVariants()} disabled={!complete || !autosave.done} aria-busy={complete && autosave.state === 'saving'} onClick={() => setLocking(true)}>{t('student.continue')}</button>
      </TaskActions>
    </>
  );
}

function Reconsidering({ attemptId, task, trace, onSubmitted, onPhase }: { attemptId: string; task: StudentTaskDTO; trace: TaskTrace; onSubmitted: (next: Slot | undefined) => void; onPhase: (phase: Phase) => void }) {
  const { t } = useTranslation();
  const original = task.initialArtifact!;
  const [answer, setAnswer] = useState<DraftArtifact>(original);
  const [finalConfidence, setFinalConfidence] = useState(task.initialConfidence ?? DEFAULT_CONFIDENCE);
  const [showLocked, setShowLocked] = useState(false);
  const submitKey = useRef(newKey());
  const promptShownAt = useRef<number | null>(null);
  const firstChange = useRef<number | null>(null);

  const queryClient = useQueryClient();
  /** A student's prompt never changes, so it is only asked for again after a language switch. */
  const challenge = useQuery({ queryKey: qk.challenge(attemptId, task.slot), queryFn: () => getChallenge(attemptId, task.slot), staleTime: Infinity });

  useEffect(() => onPhase('CHALLENGED'), [onPhase]);

  /** The next task is ready before Submit, so moving on is instant. */
  useEffect(() => {
    const next = SLOTS[SLOTS.indexOf(task.slot) + 1];
    if (next) void queryClient.prefetchQuery({ queryKey: qk.attemptTask(attemptId, next), queryFn: () => getStudentTask(attemptId, next) });
  }, [attemptId, queryClient, task.slot]);
  useEffect(() => {
    if (challenge.data) promptShownAt.current ??= Date.now();
  }, [challenge.data]);

  const unchanged = sameArtifact(answer, original);
  const submit = useMutation({
    mutationFn: () =>
      submitTask(attemptId, task.slot, { choice: unchanged ? 'KEEP' : 'REVISE', finalArtifact: answer as Artifact, finalConfidence, answerChanges: trace.changes(), ...(firstChange.current === null ? {} : { secondsToFirstChange: firstChange.current }) }, submitKey.current),
    onSuccess: ({ nextSlot }) => {
      trace.finish();
      onSubmitted(nextSlot);
    },
  });

  const log = (next: DraftArtifact) => describeChange(task, answer, next).forEach(trace.record);

  /** How long the prompt took to move the student, so the first change counts even if they go back. */
  const change = (next: DraftArtifact) => {
    log(next);
    firstChange.current ??= Math.round((Date.now() - (promptShownAt.current ?? Date.now())) / 1000);
    setAnswer(next);
  };

  if (!challenge.data) return challenge.isError ? <LoadFailed error={challenge.error} onRetry={() => void challenge.refetch()} /> : <LoadingSkeleton />;
  const lockedAnswer =
    task.slot === 'Q2' && original.slot === 'Q2' ? <LockedQ2 body={task.taskBody} answer={original} />
    : task.slot === 'Q3' && original.slot === 'Q3' ? <LockedQ3 body={task.taskBody} answer={original} />
    : task.slot === 'Q4' && original.slot === 'Q4' ? <FilledFrame body={task.taskBody} placements={original.placements} />
    : task.slot === 'Q5' && original.slot === 'Q5' ? <LockedQ5 body={task.taskBody} answer={original} />
    : <LockedAnswer summary={challenge.data.lockedSummary} />;
  const missing = missingKey(task, answer);

  return (
    <>
      <div className="bubble-tn">
        <span className="small b text-accent-ink">{t('student.think.title')}</span>
        <p className="say">{challenge.data.message}</p>
        <span className="s13 muted">{t('student.think.note')}</span>
      </div>
      <div className="row">
        <button type="button" className="lnk jump" aria-expanded={showLocked} onClick={() => setShowLocked(!showLocked)}>{t('student.think.showLocked')}</button>
        <span className="sp" />
        <button type="button" className="lnk jump" disabled={unchanged} onClick={() => {
          log(original);
          setAnswer(original);
        }}>{t('student.think.restore')}</button>
      </div>
      {showLocked ? lockedAnswer : null}
      <h1 className="stem" tabIndex={-1}>{task.stem}</h1>
      <ArtifactEditor task={task} value={answer} onChange={change} original={original} />
      <div className={cardVariants({ tone: 'tight' })}>
        <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
      </div>
      {submit.isError ? <Note kind="err">{t(errorText(submit.error))}</Note> : null}
      <TaskActions note={<span className="s13 sec">{t(missing ?? (unchanged ? 'student.final.willKeep' : 'student.final.willRevise'))}</span>}>
        <button type="button" className={buttonVariants()} aria-busy={submit.isPending} disabled={!isComplete(task, answer) || submit.isPending} onClick={() => submit.mutate()}>{t('student.submit', { slot: task.slot })}</button>
      </TaskActions>
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
  const trace = useMemo(() => createTrace(attemptId, slot), [attemptId, slot]);
  const ready = Boolean(task.data) && task.data?.phase !== 'SUBMITTED';

  useEffect(() => {
    if (ready) trace.start();
  }, [ready, trace]);

  const step = task.data?.phase === 'SUBMITTED' ? 'done' : task.data?.initialArtifact ? 'think' : task.data ? 'answer' : 'loading';

  /** No page load happens between these steps, so the student and a screen reader are moved to the new one. */
  useEffect(() => {
    if (step === 'loading') return;
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('.stem')?.focus({ preventScroll: true });
  }, [slot, step]);

  const onLocked = (challenge: StudentChallengeDTO, initialArtifact: Artifact, initialConfidence: number) => {
    queryClient.setQueryData(qk.challenge(attemptId, slot), challenge);
    queryClient.setQueryData<StudentTaskDTO>(qk.attemptTask(attemptId, slot), (old) => old && { ...old, phase: 'CHALLENGED', initialArtifact, initialConfidence });
  };

  const onSubmitted = (next: Slot | undefined) => {
    if (next) queryClient.setQueryData<StudentTaskDTO>(qk.attemptTask(attemptId, next), (old) => old && { ...old, submittedSlots: [...old.submittedSlots, slot] });
    if (next) void navigate({ to: '/s/attempts/$id/$slot', params: { id: attemptId, slot: next } });
    else void navigate({ to: '/s/attempts/$id/results', params: { id: attemptId } });
  };

  if (task.isError && !task.data) {
    if (task.error instanceof ApiError && task.error.status === 404) {
      return (
        <StudentShell title={t('student.goneAfterReset')}>
          <Link to="/s/assignments" className={buttonVariants()}>{t('student.openNewSet')}</Link>
        </StudentShell>
      );
    }
    return (
      <StudentShell lesson={lesson}>
        <LoadFailed error={task.error} onRetry={() => void task.refetch()} />
      </StudentShell>
    );
  }

  const nextAfter = SLOTS[SLOTS.indexOf(slot) + 1];

  return (
    <StudentShell lesson={lesson} current={t(`student.progress.${slot}`)} progress={<StudentProgress slots={progressFor(slot, task.data?.submittedSlots ?? [])} phase={task.data?.phase === 'SUBMITTED' ? 'SUBMITTED' : stepPhase} />} reset={<ResetRun attemptId={attemptId} />}>
      <BusyNote side="student" />
      {!task.data ? <LoadingSkeleton /> : null}
      {task.data?.phase === 'SUBMITTED' ? (
        <button type="button" className={buttonVariants()} onClick={() => onSubmitted(nextAfter)}>{t('student.continue')}</button>
      ) : null}
      {step === 'answer' ? (
        <div key={`${slot}-answer`} className="step-in">
          <Answering attemptId={attemptId} task={task.data!} trace={trace} onLocked={onLocked} onPhase={setStepPhase} />
        </div>
      ) : null}
      {step === 'think' ? (
        <div key={`${slot}-think`} className="step-in">
          <Reconsidering attemptId={attemptId} task={task.data!} trace={trace} onSubmitted={onSubmitted} onPhase={setStepPhase} />
        </div>
      ) : null}
    </StudentShell>
  );
}
