import type { Artifact, DraftArtifact, Phase, Q2Artifact, Q2TaskBody, Q3Artifact, Q3TaskBody, Q5Artifact, Slot, StudentChallengeDTO, StudentTaskDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BusyNote } from '@/components/logina/BusyNote';
import { ConfidenceSlider, DEFAULT_CONFIDENCE } from '@/components/logina/ConfidenceSlider';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { ResetRun } from '@/components/logina/ResetRun';
import { SaveStatus } from '@/components/logina/SaveStatus';
import { StickyActionBar } from '@/components/logina/StickyActionBar';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { StudentShell } from '@/components/logina/StudentShell';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { ApiError, getChallenge, getStudentTask, lockTask, newKey, saveDraft, submitTask } from '@/lib/api';
import { qk } from '@/lib/query';
import { errorKey } from '@/i18n';
import { ArtifactEditor, FilledFrame, emptyDraft, isComplete, missingKey, sameArtifact } from './editors';
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
  const [answer, setAnswer] = useState<DraftArtifact>(original);
  const [finalConfidence, setFinalConfidence] = useState(task.initialConfidence ?? DEFAULT_CONFIDENCE);
  const [showLocked, setShowLocked] = useState(false);
  const submitKey = useRef(newKey());
  const promptShownAt = useRef<number | null>(null);
  const firstChange = useRef<number | null>(null);

  const challenge = useQuery({ queryKey: qk.challenge(attemptId, task.slot), queryFn: () => getChallenge(attemptId, task.slot) });

  useEffect(() => onPhase('CHALLENGED'), [onPhase]);
  useEffect(() => {
    if (challenge.data) promptShownAt.current ??= Date.now();
  }, [challenge.data]);

  const unchanged = sameArtifact(answer, original);
  const submit = useMutation({
    mutationFn: () =>
      submitTask(attemptId, task.slot, { choice: unchanged ? 'KEEP' : 'REVISE', finalArtifact: answer as Artifact, finalConfidence, ...(firstChange.current === null ? {} : { secondsToFirstChange: firstChange.current }) }, submitKey.current),
    onSuccess: ({ nextSlot }) => onSubmitted(nextSlot),
  });

  /** How long the prompt took to move the student, so the first change counts even if they go back. */
  const change = (next: DraftArtifact) => {
    firstChange.current ??= Math.round((Date.now() - (promptShownAt.current ?? Date.now())) / 1000);
    setAnswer(next);
  };

  if (!challenge.data) return <LoadingSkeleton />;
  const lockedAnswer =
    task.slot === 'Q2' && original.slot === 'Q2' ? <LockedQ2 body={task.taskBody} answer={original} />
    : task.slot === 'Q3' && original.slot === 'Q3' ? <LockedQ3 body={task.taskBody} answer={original} />
    : task.slot === 'Q4' && original.slot === 'Q4' ? <FilledFrame body={task.taskBody} placements={original.placements} />
    : task.slot === 'Q5' && original.slot === 'Q5' ? <LockedQ5 answer={original} />
    : <LockedAnswer summary={challenge.data.lockedSummary} />;
  const missing = missingKey(task, answer);

  return (
    <>
      <div className="bubble-tn">
        <span className="small b text-navy">{t('student.think.title')}</span>
        <p className="say">{challenge.data.message}</p>
        <span className="s13 muted">{t('student.think.note')}</span>
      </div>
      <div className="row">
        <button type="button" className="lnk jump" aria-expanded={showLocked} onClick={() => setShowLocked(!showLocked)}>{t('student.think.showLocked')}</button>
        <span className="sp" />
        <button type="button" className="lnk jump" disabled={unchanged} onClick={() => setAnswer(original)}>{t('student.think.restore')}</button>
      </div>
      {showLocked ? lockedAnswer : null}
      <h1 className="stem">{task.stem}</h1>
      <ArtifactEditor task={task} value={answer} onChange={change} original={original} />
      <div className="card tight">
        <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
      </div>
      {submit.isError ? <Note kind="err">{t(errorText(submit.error))}</Note> : null}
      <TaskActions note={<span className="s13 sec">{t(missing ?? (unchanged ? 'student.final.willKeep' : 'student.final.willRevise'))}</span>}>
        <button type="button" className="btn primary" disabled={!isComplete(task, answer) || submit.isPending} onClick={() => submit.mutate()}>{t('student.submit', { slot: task.slot })}</button>
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
