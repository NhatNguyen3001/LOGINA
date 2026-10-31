import type { Artifact, DraftArtifact, Q2Artifact, Q2TaskBody, Q3Artifact, Q3TaskBody, Slot, StudentChallengeDTO, StudentTaskDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BusyNote } from '@/components/logina/BusyNote';
import { ConfidenceSlider, DEFAULT_CONFIDENCE } from '@/components/logina/ConfidenceSlider';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { PhaseLine } from '@/components/logina/PhaseLine';
import { ResetRun } from '@/components/logina/ResetRun';
import { StatusTag } from '@/components/logina/StatusTag';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { StudentShell } from '@/components/logina/StudentShell';
import { SwitchSide } from '@/components/logina/SwitchSide';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { ApiError, getChallenge, getStudentTask, lockTask, newKey, saveDraft, submitTask } from '@/lib/api';
import { qk } from '@/lib/query';
import { errorKey } from '@/i18n';
import { ArtifactEditor, emptyDraft, isComplete, sameArtifact } from './editors';

const SLOTS: Slot[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
const AUTOSAVE_MS = 800;

const progressFor = (current: Slot) =>
  SLOTS.map((slot) => {
    const offset = SLOTS.indexOf(slot) - SLOTS.indexOf(current);
    return { slot, state: offset < 0 ? ('done' as const) : offset === 0 ? ('on' as const) : ('todo' as const) };
  });

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

function Answering({ attemptId, task, onLocked }: { attemptId: string; task: StudentTaskDTO; onLocked: () => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftArtifact>(() => emptyDraft(task));
  const [locking, setLocking] = useState(false);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const lockKey = useRef(newKey());
  const lockSent = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }
    const timer = setTimeout(() => void saveDraft(attemptId, task.slot, { draftArtifact: draft }).catch(() => {}), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [attemptId, draft, task.slot]);

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

  const complete = isComplete(task, draft);

  if (locking) {
    return (
      <>
        <PhaseLine phase="CONFIDENCE_1" />
        <h1 className="stem">{t('student.lock.question')}</h1>
        <ConfidenceSlider value={confidence} onChange={setConfidence} />
        <p className="s13 sec">{t('student.lock.hint')}</p>
        <p className="s13 sec">{t('student.lock.note')}</p>
        {lock.isError ? <Note kind="err">{t(errorText(lock.error))}</Note> : null}
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => setLocking(false)}>{t('student.lock.back')}</button>
          <span className="sp" />
          <button type="button" className="btn primary" disabled={lock.isPending} onClick={sendLock}>{t('student.lock.button')}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <PhaseLine phase="REASON" />
      <h1 className="stem">{task.stem}</h1>
      <ArtifactEditor task={task} value={draft} onChange={setDraft} />
      <div className="row">
        <span className="sp" />
        <button type="button" className="btn primary" disabled={!complete} onClick={() => setLocking(true)}>{t('student.continue')}</button>
      </div>
    </>
  );
}

function Reconsidering({ attemptId, task, onSubmitted }: { attemptId: string; task: StudentTaskDTO; onSubmitted: (next: Slot | undefined) => void }) {
  const { t } = useTranslation();
  const original = task.initialArtifact!;
  const initialConfidence = task.initialConfidence ?? 0;
  const [choice, setChoice] = useState<'KEEP' | 'REVISE' | null>(null);
  const [revised, setRevised] = useState<DraftArtifact>(original);
  const [finalConfidence, setFinalConfidence] = useState(DEFAULT_CONFIDENCE);
  const submitKey = useRef(newKey());

  const challenge = useQuery({ queryKey: qk.challenge(attemptId, task.slot), queryFn: () => getChallenge(attemptId, task.slot) });

  const submit = useMutation({
    mutationFn: () =>
      submitTask(attemptId, task.slot, { choice: choice!, finalArtifact: (choice === 'KEEP' ? original : revised) as Artifact, finalConfidence }, submitKey.current),
    onSuccess: ({ nextSlot }) => onSubmitted(nextSlot),
  });

  if (!challenge.data) return <LoadingSkeleton />;
  const lockedAnswer =
    task.slot === 'Q2' && original.slot === 'Q2' ? <LockedQ2 body={task.taskBody} answer={original} />
    : task.slot === 'Q3' && original.slot === 'Q3' ? <LockedQ3 body={task.taskBody} answer={original} />
    : <LockedAnswer summary={challenge.data.lockedSummary} />;
  const submitLabel = t('student.submit', { slot: task.slot });
  const failure = submit.isError ? <Note kind="err">{t(errorText(submit.error))}</Note> : null;

  if (choice === 'KEEP') {
    return (
      <>
        <PhaseLine phase="CONFIDENCE_2" />
        <div className="row">
          <h1 className="stem grow">{t('student.final.keepTitle')}</h1>
          <StatusTag kind="neutral">{t('student.final.readOnly')}</StatusTag>
        </div>
        <div className="card">
          <div className="row">
            <StatusTag kind="neutral">{t('student.final.unchanged')}</StatusTag>
            <span className="sp" />
            <button type="button" className="lnk jump" onClick={() => setChoice('REVISE')}>{t('student.final.changeMind')}</button>
          </div>
          {lockedAnswer}
        </div>
        <div className="card tight">
          <div className="row">
            <span className="sp" />
            <span className="s13 muted num">{t('student.final.original', { value: initialConfidence })}</span>
          </div>
          <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
          <span className="s13 sec">{t('student.final.confidenceNote')}</span>
        </div>
        {failure}
        <div className="row">
          <span className="sp" />
          <button type="button" className="btn primary" disabled={submit.isPending} onClick={() => submit.mutate()}>{submitLabel}</button>
        </div>
      </>
    );
  }

  if (choice === 'REVISE') {
    const unchanged = sameArtifact(revised, original);
    const ready = isComplete(task, revised);
    return (
      <>
        <PhaseLine phase="RECONSIDER" />
        <h1 className="stem">{t('student.final.reviseTitle')}</h1>
        <ArtifactEditor task={task} value={revised} onChange={setRevised} original={original} />
        {unchanged ? <Note kind="info">{t('student.final.sameAsFirst')}</Note> : <Note kind="info">{t('student.final.onlyRevision', { slot: task.slot })}</Note>}
        <div className="card tight">
          <div className="row">
            <span className="b">{t('student.final.confidence')}</span>
            <span className="sp" />
            <span className="s13 muted num">{t('student.final.original', { value: initialConfidence })}</span>
          </div>
          <ConfidenceSlider value={finalConfidence} onChange={setFinalConfidence} />
        </div>
        {failure}
        <div className="row">
          <span className="sp" />
          <button type="button" className="btn primary" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>{submitLabel}</button>
        </div>
      </>
    );
  }

  return (
    <>
      <PhaseLine phase="CHALLENGED" />
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
        <button type="button" className="btn secondary" onClick={() => setChoice('KEEP')}>{t('student.keep')}</button>
        <button type="button" className="btn secondary" onClick={() => setChoice('REVISE')}>{t('student.revise')}</button>
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
    <StudentShell title={t('student.home.title')} progress={<StudentProgress slots={progressFor(slot)} />} actions={<><ResetRun attemptId={attemptId} /><SwitchSide to="teacher" /></>}>
      <BusyNote side="student" />
      {!task.data ? <LoadingSkeleton /> : null}
      {task.data?.phase === 'SUBMITTED' ? (
        <button type="button" className="btn primary" onClick={() => onSubmitted(nextAfter)}>{t('student.continue')}</button>
      ) : null}
      {task.data && task.data.phase !== 'SUBMITTED' && !task.data.initialArtifact ? (
        <Answering key={slot} attemptId={attemptId} task={task.data} onLocked={() => void queryClient.invalidateQueries({ queryKey: qk.attemptTask(attemptId, slot) })} />
      ) : null}
      {task.data && task.data.phase !== 'SUBMITTED' && task.data.initialArtifact ? <Reconsidering key={slot} attemptId={attemptId} task={task.data} onSubmitted={onSubmitted} /> : null}
    </StudentShell>
  );
}
