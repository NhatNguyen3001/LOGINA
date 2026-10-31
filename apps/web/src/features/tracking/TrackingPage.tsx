import type { ClassTrackingDTO } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Activity, Check, LayoutDashboard, MessageSquare, PenLine, Users, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { getMyAssignments, getTracking } from '@/lib/api';
import { qk } from '@/lib/query';

type TaskRow = ClassTrackingDTO['perTask'][number];

const TABS: { id: 'dashboard' | 'students' | 'prompts'; icon: LucideIcon }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'students', icon: Users },
  { id: 'prompts', icon: MessageSquare },
];

const TOP_PROMPTS = 3;

const share = (part: number, whole: number) => (whole > 0 ? `${(part / whole) * 100}%` : '0%');

/** Each task counts by how many answers it has, so a task few people reached does not outweigh the rest. */
function averageConfidence(rows: TaskRow[], pick: (row: TaskRow) => number | null): number | null {
  const counted = rows.filter((row) => pick(row) !== null && row.submitted > 0);
  const answers = counted.reduce((sum, row) => sum + row.submitted, 0);
  return answers ? Math.round(counted.reduce((sum, row) => sum + pick(row)! * row.submitted, 0) / answers) : null;
}

function Metric({ icon: Icon, good, label, value, of, part, whole, hint }: { icon: LucideIcon; good?: boolean; label: string; value: string; of?: string; part?: number; whole?: number; hint?: string }) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span className={`metric-ic ${good ? 'good' : ''}`}><Icon className="ico" aria-hidden="true" /></span>
        <span>{label}</span>
      </div>
      <div className="metric-val num">
        {value}
        {of ? <small> {of}</small> : null}
      </div>
      {whole === undefined ? <span className="metric-hint">{hint}</span> : <div className="meter" aria-hidden="true"><i style={{ width: share(part ?? 0, whole) }} /></div>}
    </div>
  );
}

function ChartCard({ title, legend, wide, children }: { title: string; legend?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`dash-card ${wide ? 'wide' : ''}`}>
      <div className="dash-head">
        <h2 className="b">{title}</h2>
        {legend ? <div className="dash-legend">{legend}</div> : null}
      </div>
      {children}
    </section>
  );
}

function KeepReviseChart({ rows }: { rows: TaskRow[] }) {
  const { t } = useTranslation();
  return (
    <ChartCard
      title={t('teacher.t14.keepReviseTitle')}
      legend={<><span><i className="sw kept" />{t('teacher.t14.kept')}</span><span><i className="sw revised" />{t('teacher.t14.revised')}</span></>}
    >
      {rows.map(({ slot, keep, revise }) => {
        const total = keep + revise;
        const label = t('teacher.t14.barKeep', { slot, keep, revise });
        return (
          <div key={slot} className="dash-row">
            <span className="b">{slot}</span>
            <div className="dash-bar" role="img" aria-label={label} title={label}>
              {keep ? <i className="kept" style={{ width: share(keep, total) }} /> : null}
              {revise ? <i className="revised" style={{ width: share(revise, total) }} /> : null}
            </div>
            <span className="dash-num num">{`${keep} / ${revise}`}</span>
          </div>
        );
      })}
    </ChartCard>
  );
}

function ConfidenceChart({ rows }: { rows: TaskRow[] }) {
  const { t } = useTranslation();
  return (
    <ChartCard
      title={t('teacher.t14.confidenceTitle')}
      legend={<><span><i className="sw round first" />{t('teacher.t14.firstDot')}</span><span><i className="sw round final" />{t('teacher.t14.finalDot')}</span></>}
    >
      {rows.map(({ slot, avgConfidenceBefore, avgConfidenceAfter }) => {
        const before = avgConfidenceBefore === null ? null : Math.round(avgConfidenceBefore);
        const after = before === null ? null : Math.round(avgConfidenceAfter ?? 0);
        const text = before === null ? '–' : `${before} → ${after}`;
        const label = t('teacher.t14.barConfidence', { slot, change: text });
        return (
          <div key={slot} className="dash-row wide-num">
            <span className="b">{slot}</span>
            <div className="dumbbell" role="img" aria-label={label} title={label}>
              {before !== null && after !== null ? (
                <>
                  <i className="link" style={{ left: `${Math.min(before, after)}%`, width: `${Math.abs(after - before)}%` }} />
                  <i className="dot first" style={{ left: `${before}%` }} />
                  <i className="dot final" style={{ left: `${after}%` }} />
                </>
              ) : null}
            </div>
            <span className="dash-num num">{text}</span>
          </div>
        );
      })}
    </ChartCard>
  );
}

function PromptRow({ tag, message, count, revised, clip }: { tag: string; message: string; count: number; revised: number; clip?: boolean }) {
  const { t } = useTranslation();
  const label = t('teacher.t14.revisedOf', { revised, count });
  return (
    <div className="prompt-row">
      <span className="tag info num">{tag}</span>
      <span className={`s13 ${clip ? 'clip' : ''}`} title={message}>{message}</span>
      <div className="dash-bar single" aria-hidden="true">{revised ? <i className="revised" style={{ width: share(revised, count) }} /> : null}</div>
      <span className="dash-num num">{label}</span>
    </div>
  );
}

/** "Followed by", not "caused": a teacher sees what happened after a prompt, never why. */
function TopPrompts({ rows, onSeeAll }: { rows: TaskRow[]; onSeeAll: () => void }) {
  const { t } = useTranslation();
  const prompts = rows
    .flatMap(({ slot, deliveredChallenges }) => deliveredChallenges.map((challenge) => ({ ...challenge, slot })))
    .sort((a, b) => b.revised - a.revised || b.revised / b.count - a.revised / a.count);
  return (
    <ChartCard title={t('teacher.t14.promptsTitle')} legend={<button type="button" className="lnk jump" onClick={onSeeAll}>{t('teacher.t14.seeAll')}</button>} wide>
      {prompts.slice(0, TOP_PROMPTS).map(({ slot, label, message, count, revised }) => (
        <PromptRow key={`${slot}-${label}`} tag={`${slot} · ${label}`} message={message} count={count} revised={revised} clip />
      ))}
    </ChartCard>
  );
}

function Dashboard({ data, onSeeAll }: { data: ClassTrackingDTO; onSeeAll: () => void }) {
  const { t } = useTranslation();
  const { counts, perTask } = data;
  const keep = perTask.reduce((sum, row) => sum + row.keep, 0);
  const revise = perTask.reduce((sum, row) => sum + row.revise, 0);
  const total = keep + revise;
  const before = averageConfidence(perTask, (row) => row.avgConfidenceBefore);
  const after = averageConfidence(perTask, (row) => row.avgConfidenceAfter);

  return (
    <>
      <p className="vh">{t('teacher.t14.counts', { started: counts.started, finished: counts.complete })}</p>
      <div className="metrics">
        <Metric icon={Users} label={t('teacher.t14.started')} value={String(counts.started)} hint={t('teacher.t14.inAssignment')} />
        <Metric icon={Check} good label={t('teacher.t14.finished')} value={String(counts.complete)} of={t('teacher.t14.ofTotal', { total: counts.started })} part={counts.complete} whole={counts.started} />
        <Metric icon={PenLine} label={t('teacher.t14.answersRevised')} value={String(revise)} of={t('teacher.t14.ofTotal', { total })} part={revise} whole={total} />
        <Metric icon={Activity} label={t('teacher.t14.avgConfidenceTitle')} value={before === null ? '–' : `${before} → ${after}`} hint={t('teacher.t14.firstToFinal')} />
      </div>
      {total === 0 ? <p className="dash-empty">{t('teacher.t14.empty')}</p> : null}
      <div className="dash-grid">
        <KeepReviseChart rows={perTask} />
        <ConfidenceChart rows={perTask} />
        {total > 0 ? <TopPrompts rows={perTask} onSeeAll={onSeeAll} /> : null}
      </div>
      <p className="small muted">{t('teacher.t14.disclaimer')}</p>
    </>
  );
}

function Students({ data }: { data: ClassTrackingDTO }) {
  const { t } = useTranslation();
  if (data.participants.length === 0) return <p className="dash-empty">{t('teacher.t14.empty')}</p>;
  return (
    <div className="card flush">
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
            {data.participants.map((person) => (
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
  );
}

function Prompts({ rows }: { rows: TaskRow[] }) {
  const { t } = useTranslation();
  if (rows.every((row) => row.deliveredChallenges.length === 0)) return <p className="dash-empty">{t('teacher.t14.noPrompts')}</p>;
  return (
    <>
      <p className="s13 sec">{t('teacher.t14.promptsNote')}</p>
      <div className="prompt-list">
        {rows.map(({ slot, deliveredChallenges }) => (
          <ChartCard key={slot} title={t(`teacher.taskType.${slot}`)}>
            {deliveredChallenges.length === 0 ? <span className="s13 muted">{t('teacher.t14.noPrompts')}</span> : null}
            {deliveredChallenges.map(({ label, message, count, revised }) => (
              <PromptRow key={label} tag={label} message={message} count={count} revised={revised} />
            ))}
          </ChartCard>
        ))}
      </div>
    </>
  );
}

export function TrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('dashboard');
  const tracking = useQuery({ queryKey: qk.tracking(id), queryFn: () => getTracking(id) });
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments });
  if (!tracking.data) return tracking.isError ? <p className="muted">{t('errors.NOT_FOUND')}</p> : <LoadingSkeleton />;

  const { participants, perTask, releaseLabels } = tracking.data;
  const lesson = assignments.data?.assignments.find((item) => item.assignmentId === id)?.lessonTitle;
  const releases = t('teacher.t14.lede', { releases: Object.entries(releaseLabels).map(([slot, label]) => `${slot} ${label}`).join(', ') });

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t14.title')}</span>
      </nav>
      <div className="track-head">
        <h1 className="h1">{t('teacher.t14.title')}</h1>
        {lesson ? <p className="s15 m">{lesson}</p> : null}
        <p className="s13 muted">{releases}</p>
      </div>
      <div className="track-tabs" role="tablist" aria-label={t('teacher.t14.title')}>
        {TABS.map(({ id: name, icon: Icon }) => (
          <button key={name} type="button" role="tab" id={`tab-${name}`} aria-selected={tab === name} aria-controls={`panel-${name}`} className={tab === name ? 'on' : undefined} onClick={() => setTab(name)}>
            <Icon className="ico" aria-hidden="true" />
            {t(`teacher.t14.tab.${name}`)}
            {name === 'students' ? <span className="tab-count num">{participants.length}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="track-panel">
        {tab === 'dashboard' ? <Dashboard data={tracking.data} onSeeAll={() => setTab('prompts')} /> : null}
        {tab === 'students' ? <Students data={tracking.data} /> : null}
        {tab === 'prompts' ? <Prompts rows={perTask} /> : null}
      </div>
    </>
  );
}
