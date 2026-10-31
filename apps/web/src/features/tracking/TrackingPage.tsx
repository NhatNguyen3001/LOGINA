import type { ClassTrackingDTO } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { getTracking } from '@/lib/api';
import { qk } from '@/lib/query';

type Relations = ClassTrackingDTO['q1Relations']['before'];

const SEGMENTS = [
  { key: 'full', css: 'full' },
  { key: 'partial', css: 'part' },
  { key: 'contradicts', css: 'contra' },
  { key: 'irrelevant', css: 'none' },
] as const;

function RelationRow({ label, counts, denominator }: { label: string; counts: Relations; denominator: number }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <span className="s13 m">{label}</span>
      <div className="row">
        {SEGMENTS.map(({ key, css }) => (
          <span key={key} className={`rel ${css}`}>{`${t(`teacher.t14.relation.${key}`)} ${counts[key]}/${denominator}`}</span>
        ))}
      </div>
    </div>
  );
}

export function TrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const tracking = useQuery({ queryKey: qk.tracking(id), queryFn: () => getTracking(id) });
  if (!tracking.data) return tracking.isError ? <p className="muted">{t('errors.NOT_FOUND')}</p> : <LoadingSkeleton />;

  const { counts, participants, perTask, q1Relations, releaseLabels } = tracking.data;
  const keep = perTask.reduce((sum, row) => sum + row.keep, 0);
  const revise = perTask.reduce((sum, row) => sum + row.revise, 0);

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t14.title')}</span>
      </nav>
      <h1 className="h1">{t('teacher.t14.title')}</h1>
      <p className="lede">{t('teacher.t14.lede', { releases: Object.entries(releaseLabels).map(([slot, label]) => `${slot} ${label}`).join(', ') })}</p>
      <div className="trio">
        <div className="card tight">
          <span className="small b sec">{t('teacher.t14.attempts')}</span>
          <span className="bb num">{t('teacher.t14.counts', { started: counts.started, finished: counts.complete })}</span>
        </div>
        <div className="card tight">
          <span className="small b sec">{t('teacher.t14.afterThink')}</span>
          <span className="m num">{t('teacher.t14.keepRevise', { keep, revise, total: keep + revise })}</span>
        </div>
      </div>
      <div className="card flush">
        <h3 className="s15 b p-4">{t('teacher.t14.byTask')}</h3>
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('student.result.task')}</th>
                <th>{t('teacher.t14.submitted')}</th>
                <th>{t('teacher.t14.keepOrRevise')}</th>
                <th>{t('teacher.t14.avgConfidence')}</th>
                <th>{t('teacher.t14.prompts')}</th>
              </tr>
            </thead>
            <tbody>
              {perTask.map((row) => (
                <tr key={row.slot}>
                  <td className="b">{row.slot}</td>
                  <td className="num">{row.submitted}</td>
                  <td className="num">{`${row.keep} / ${row.revise}`}</td>
                  <td className="num">{row.avgConfidenceBefore === null ? '–' : `${Math.round(row.avgConfidenceBefore)} → ${Math.round(row.avgConfidenceAfter ?? 0)}`}</td>
                  <td className="num">{row.deliveredChallenges.map((c) => `${c.label} · ${c.count}`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <h3 className="s15 b">{t('teacher.t14.relations')}</h3>
          <span className="sp" />
          <span className="s13 muted num">{t('teacher.t14.relationsNote', { count: q1Relations.denominator, release: q1Relations.releaseLabel })}</span>
        </div>
        <RelationRow label={t('teacher.t14.first')} counts={q1Relations.before} denominator={q1Relations.denominator} />
        <RelationRow label={t('teacher.t14.final')} counts={q1Relations.after} denominator={q1Relations.denominator} />
        <p className="small muted">{t('teacher.t14.disclaimer')}</p>
      </div>
      <div className="card flush">
        <h3 className="s15 b p-4">{t('teacher.t14.participants')}</h3>
        <div className="tbl-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>{t('teacher.t14.code')}</th>
                <th>{t('teacher.t14.progress')}</th>
                <th>{t('teacher.t14.keepOrRevise')}</th>
                <th>{t('student.result.confidence')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {participants.map((person) => (
                <tr key={person.attemptId}>
                  <td className="b num">
                    {person.participantCode ?? t('teacher.t14.notInResearch')}
                    {person.isSimulated ? <> <StatusTag kind="neutral">{t('teacher.t14.simulated')}</StatusTag></> : null}
                  </td>
                  <td className="num">{`${person.submittedCount}/5`}</td>
                  <td className="num">{`${person.keepCount} / ${person.reviseCount}`}</td>
                  <td className="num">{person.confidenceBefore === undefined ? '–' : `${Math.round(person.confidenceBefore)} → ${Math.round(person.confidenceAfter ?? 0)}`}</td>
                  <td>
                    {person.submittedCount > 0 ? <Link to="/t/attempts/$id/trace/$slot" params={{ id: person.attemptId, slot: 'Q1' }} className="lnk">{t('teacher.t14.trace')}</Link> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
