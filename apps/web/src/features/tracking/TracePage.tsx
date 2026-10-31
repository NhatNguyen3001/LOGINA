import type { Slot } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { getTrace } from '@/lib/api';
import { qk } from '@/lib/query';

function Choice({ label, letter, authoring, text, changed }: { label: string; letter: string; authoring: string; text: string; changed?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <span className="s13 muted">
        {label}
        {changed ? <span className="newtag">{t('teacher.t15.changed')}</span> : null}
      </span>
      {letter ? (
        <span className="m">
          {letter} <span className="muted">{`(${authoring})`}</span>
          {` · ${text}`}
        </span>
      ) : (
        <span className="m">{text}</span>
      )}
    </div>
  );
}

export function TracePage() {
  const { t, i18n } = useTranslation();
  const { id, slot } = useParams({ strict: false }) as { id: string; slot: Slot };
  const trace = useQuery({ queryKey: qk.trace(id, slot), queryFn: () => getTrace(id, slot) });
  if (!trace.data) return trace.isError ? <p className="muted">{t('errors.NOT_FOUND')}</p> : <LoadingSkeleton />;

  const { assignmentId, participantCode, isSimulated, completedAt, releaseLabel, slotChips, questionStem, before, challenge, after } = trace.data;
  const person = participantCode ?? t('teacher.t14.notInResearch');
  const answerLabel = t(before.evidence ? 'student.think.statement' : 'student.think.answer');
  const time = (value: string) => new Date(value).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <Link to="/t/assignments/$id" params={{ id: assignmentId }}>{t('teacher.t14.title')}</Link>
        <span>/</span>
        <span>{person}</span>
      </nav>
      <div className="row">
        <h1 className="h1 num">{person}</h1>
        {completedAt ? <StatusTag kind="pass">{t('teacher.t15.completed', { time: new Date(completedAt).toLocaleString(i18n.language) })}</StatusTag> : null}
        {isSimulated ? <StatusTag kind="neutral">{t('teacher.t14.simulated')}</StatusTag> : null}
      </div>
      <p className="lede">{t('teacher.t15.release', { slot, release: releaseLabel })}</p>
      <div className="row">
        {slotChips.map((chip) =>
          chip.choice ? (
            <Link key={chip.slot} to="/t/attempts/$id/trace/$slot" params={{ id, slot: chip.slot }} className={`chip no-underline ${chip.slot === slot ? 'on' : ''}`} {...(chip.slot === slot ? { 'aria-current': 'page' as const } : {})}>
              {`${chip.slot} · ${t(chip.choice === 'KEEP' ? 'student.result.keep' : 'student.result.revise')}`}
            </Link>
          ) : (
            <span key={chip.slot} className="chip idle">{chip.slot}</span>
          ),
        )}
      </div>
      <div className="card tight">
        <span className="small b sec">{t('teacher.t07.question')}</span>
        <p className="m">{questionStem}</p>
      </div>
      <div className="trio">
        <div className="card">
          <div className="row">
            <span className="small b sec">{t('teacher.t15.first')}</span>
            <span className="sp" />
            <span className="s13 muted num">{t('teacher.t15.locked', { time: time(before.lockedAt) })}</span>
          </div>
          <Choice label={answerLabel} letter={before.answer.letter} authoring={before.answer.authoringLabel} text={before.answer.text} />
          {before.evidence ? <Choice label={t('student.think.card')} letter={before.evidence.letter} authoring={before.evidence.authoringLabel} text={before.evidence.text} /> : null}
          <div className="row">
            <span className="s13 muted grow">{t('student.result.confidence')}</span>
            <span className="bb num">{before.confidence}</span>
          </div>
          {before.relationLabel ? <span className="rel none">{before.relationLabel}</span> : null}
        </div>
        <div className="card b-navy">
          <div className="row">
            <span className="small b">{t('teacher.t15.think')}</span>
            <span className="sp" />
            <span className="tag info">{challenge.label}</span>
          </div>
          <p className="m">{challenge.message}</p>
          <span className="s13 sec">{t('teacher.t15.why', { reason: challenge.whySelected })}</span>
          <div className="row">
            <span className="s13 muted grow">{t('teacher.t15.chose')}</span>
            <span className="tag neutral">{t(challenge.studentChoice === 'KEEP' ? 'student.keep' : 'student.revise')}</span>
          </div>
        </div>
        <div className="card">
          <div className="row">
            <span className="small b sec">{t('teacher.t15.final')}</span>
            <span className="sp" />
            <span className="s13 muted num">{t('teacher.t15.submitted', { time: time(after.submittedAt) })}</span>
          </div>
          <Choice label={answerLabel} letter={after.answer.letter} authoring={after.answer.authoringLabel} text={after.answer.text} changed={after.answer.changed} />
          {after.evidence ? <Choice label={t('student.think.card')} letter={after.evidence.letter} authoring={after.evidence.authoringLabel} text={after.evidence.text} changed={after.evidence.changed} /> : null}
          <div className="row">
            <span className="s13 muted grow">{t('student.result.confidence')}</span>
            <span className="bb num">{`${after.confidenceBefore} → ${after.confidenceAfter}`}</span>
          </div>
          {after.relationLabel ? <span className="rel none">{after.relationLabel}</span> : null}
        </div>
      </div>
      <p className="small muted">{t('teacher.t15.disclaimer')}</p>
    </>
  );
}
