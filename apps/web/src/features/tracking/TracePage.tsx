import type { Slot } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
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
      <span className="m">
        {letter} <span className="muted">{`(${authoring})`}</span>
        {` · ${text}`}
      </span>
    </div>
  );
}

export function TracePage() {
  const { t, i18n } = useTranslation();
  const { id, slot } = useParams({ strict: false }) as { id: string; slot: Slot };
  const trace = useQuery({ queryKey: qk.trace(id, slot), queryFn: () => getTrace(id, slot) });
  if (!trace.data) return <p className="muted">{t(trace.isError ? 'errors.NOT_FOUND' : 'common.loading')}</p>;

  const { participantCode, isSimulated, completedAt, releaseLabel, slotChips, questionStem, before, challenge, after } = trace.data;
  const time = (value: string) => new Date(value).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <div className="row">
        <h1 className="h1 num">{participantCode ?? t('teacher.t14.notInResearch')}</h1>
        {completedAt ? <StatusTag kind="pass">{t('teacher.t15.completed', { time: new Date(completedAt).toLocaleString(i18n.language) })}</StatusTag> : null}
        {isSimulated ? <StatusTag kind="neutral">{t('teacher.t14.simulated')}</StatusTag> : null}
      </div>
      <p className="lede">{t('teacher.t15.release', { slot, release: releaseLabel })}</p>
      <div className="row">
        {slotChips.map((chip) => (
          <span key={chip.slot} className={`chip ${chip.slot === slot ? 'on' : ''}`}>
            {chip.choice ? `${chip.slot} · ${t(chip.choice === 'KEEP' ? 'student.result.keep' : 'student.result.revise')}` : chip.slot}
          </span>
        ))}
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
          <Choice label={t('student.think.statement')} letter={before.answer.letter} authoring={before.answer.authoringLabel} text={before.answer.text} />
          <Choice label={t('student.think.card')} letter={before.evidence.letter} authoring={before.evidence.authoringLabel} text={before.evidence.text} />
          <div className="row">
            <span className="s13 muted grow">{t('student.result.confidence')}</span>
            <span className="bb num">{before.confidence}</span>
          </div>
          <span className="rel none">{before.relationLabel}</span>
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
          <Choice label={t('student.think.statement')} letter={after.answer.letter} authoring={after.answer.authoringLabel} text={after.answer.text} changed={after.answer.changed} />
          <Choice label={t('student.think.card')} letter={after.evidence.letter} authoring={after.evidence.authoringLabel} text={after.evidence.text} changed={after.evidence.changed} />
          <div className="row">
            <span className="s13 muted grow">{t('student.result.confidence')}</span>
            <span className="bb num">{`${after.confidenceBefore} → ${after.confidenceAfter}`}</span>
          </div>
          <span className="rel none">{after.relationLabel}</span>
        </div>
      </div>
      <p className="small muted">{t('teacher.t15.disclaimer')}</p>
    </>
  );
}
