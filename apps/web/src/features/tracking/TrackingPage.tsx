import type { ClassTrackingDTO } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Activity, Check, LayoutDashboard, MessageSquare, PenLine, Users, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@/components/logina/BackLink';
import { promptName } from '@/lib/prompt-name';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMyAssignments, getTracking } from '@/lib/api';
import { qk } from '@/lib/query';
import { Badge } from '@/components/ui/badge';
import { cardVariants } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart } from '@/components/tremor/BarChart';
import { CategoryBar } from '@/components/tremor/CategoryBar';
import { ProgressBar } from '@/components/tremor/ProgressBar';

type TaskRow = ClassTrackingDTO['perTask'][number];
type TabId = 'dashboard' | 'students' | 'prompts';

const TABS: { id: TabId; icon: LucideIcon }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'students', icon: Users },
  { id: 'prompts', icon: MessageSquare },
];

const TOP_PROMPTS = 3;


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
      {whole === undefined ? <span className="metric-hint">{hint}</span> : <ProgressBar value={part ?? 0} max={whole} aria-label={label} className="metric-bar" />}
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

/** A bar a teacher can click, tap or reach by keyboard to read its numbers, where a hover title reached only a mouse. */
function BarHint({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={className} aria-label={label}>{children}</button>
      </PopoverTrigger>
      <PopoverContent side="top">{label}</PopoverContent>
    </Popover>
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
            <BarHint className="dash-bar" label={label}>
              {total > 0 ? <CategoryBar values={[keep, revise]} colors={['control', 'accent']} showLabels={false} className="w-full" /> : null}
            </BarHint>
            <span className="dash-num num">{`${keep} / ${revise}`}</span>
          </div>
        );
      })}
    </ChartCard>
  );
}

function ConfidenceChart({ rows }: { rows: TaskRow[] }) {
  const { t } = useTranslation();
  const first = t('teacher.t14.firstDot');
  const final = t('teacher.t14.finalDot');
  const points = rows.map(({ slot, avgConfidenceBefore, avgConfidenceAfter }) => {
    const before = avgConfidenceBefore === null ? null : Math.round(avgConfidenceBefore);
    return { slot, [first]: before, [final]: before === null ? null : Math.round(avgConfidenceAfter ?? 0) };
  });
  return (
    <ChartCard
      title={t('teacher.t14.confidenceTitle')}
      legend={<><span><i className="sw round first" />{first}</span><span><i className="sw round final" />{final}</span></>}
    >
      <div aria-hidden="true">
        <BarChart data={points} index="slot" categories={[first, final]} colors={['control', 'accent']} minValue={0} maxValue={100} showLegend={false} yAxisWidth={32} className="h-44" />
        {/* The numbers stay readable on a projected screen, not only on hover; screen readers get the table below. */}
        <ul className="conf-nums">
          {points.map((point) => (
            <li key={point.slot}>
              <span className="num">{point[first] === null ? '–' : `${point[first]} → ${point[final]}`}</span>
            </li>
          ))}
        </ul>
      </div>
      <table className="vh" aria-label={t('teacher.t14.confidenceTitle')}>
        <thead>
          <tr><th>{t('student.result.task')}</th><th>{first}</th><th>{final}</th></tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.slot}><td>{point.slot}</td><td>{point[first] ?? '–'}</td><td>{point[final] ?? '–'}</td></tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  );
}

function PromptRow({ tag, message, count, revised, clip }: { tag: string; message: string; count: number; revised: number; clip?: boolean }) {
  const { t } = useTranslation();
  const label = t('teacher.t14.revisedOf', { revised, count });
  return (
    <div className="prompt-row">
      <Badge kind="info" className="num">{tag}</Badge>
      {clip ? <BarHint className="s13 clip" label={message}>{message}</BarHint> : <span className="s13">{message}</span>}
      <ProgressBar value={revised} max={count} variant="accent" aria-hidden="true" className="prompt-bar" />
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
        <PromptRow key={`${slot}-${label}`} tag={`${slot} · ${promptName(label, t)}`} message={message} count={count} revised={revised} clip />
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
    <div className={cardVariants({ tone: 'flush' })}>
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('teacher.t14.code')}</TableHead>
              <TableHead>{t('teacher.t14.progress')}</TableHead>
              <TableHead>{t('teacher.t14.keepOrRevise')}</TableHead>
              <TableHead>{t('student.result.confidence')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.participants.map((person) => (
              <TableRow key={person.attemptId}>
                <TableCell className="b num">
                  {person.participantCode ?? t('teacher.t14.notInResearch')}
                  {person.isSimulated ? <> <StatusTag kind="neutral">{t('teacher.t14.simulated')}</StatusTag></> : null}
                </TableCell>
                <TableCell className="num">{`${person.submittedCount}/5`}</TableCell>
                <TableCell className="num">{`${person.keepCount} / ${person.reviseCount}`}</TableCell>
                <TableCell className="num">{person.confidenceBefore === undefined ? '–' : `${Math.round(person.confidenceBefore)} → ${Math.round(person.confidenceAfter ?? 0)}`}</TableCell>
                <TableCell>
                  {person.submittedCount > 0 ? <Link to="/t/attempts/$id/trace/$slot" params={{ id: person.attemptId, slot: 'Q1' }} className="lnk">{t('teacher.t14.trace')}</Link> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              <PromptRow key={label} tag={promptName(label, t)} message={message} count={count} revised={revised} />
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
  const [tab, setTab] = useState<TabId>('dashboard');
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
      <BackLink to="/t/lessons" label={t('teacher.t14.backToLessons')} />
      <div className="track-head">
        <h1 className="h1">{t('teacher.t14.title')}</h1>
        {lesson ? <p className="s15 m">{lesson}</p> : null}
        <p className="s13 muted">{releases}</p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="contents">
        <TabsList className="track-tabs" aria-label={t('teacher.t14.title')}>
          {TABS.map(({ id: name, icon: Icon }) => (
            <TabsTrigger key={name} value={name}>
              <Icon className="ico" aria-hidden="true" />
              {t(`teacher.t14.tab.${name}`)}
              {name === 'students' ? <span className="tab-count num">{participants.length}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="dashboard" className="track-panel"><Dashboard data={tracking.data} onSeeAll={() => setTab('prompts')} /></TabsContent>
        <TabsContent value="students" className="track-panel"><Students data={tracking.data} /></TabsContent>
        <TabsContent value="prompts" className="track-panel"><Prompts rows={perTask} /></TabsContent>
      </Tabs>
    </>
  );
}
