import type { ResolveIssueReq, SourceReviewDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiffRow } from '@/components/logina/DiffRow';
import { Note } from '@/components/logina/Note';
import { Pick } from '@/components/logina/Pick';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { RestartAnalysis } from '@/features/lessons/RestartAnalysis';
import { errorKey } from '@/i18n';
import { ApiError, getSourceReview, newKey, resolveIssue } from '@/lib/api';
import { qk } from '@/lib/query';
import { cn } from '@/lib/utils';

type Issue = SourceReviewDTO['issues'][number];
type Mode = 'adjust' | 'keepOpen' | 'exclude' | null;
type Resolution = ResolveIssueReq extends infer R ? (R extends { baseVersion: number } ? Omit<R, 'baseVersion'> : never) : never;

function IssueCard({ issue, onResolve, pending, onFocusPoint }: { issue: Issue; onResolve: (req: Resolution) => void; pending: boolean; onFocusPoint: (point: number | null) => void }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>(null);
  const [suggestion, setSuggestion] = useState(issue.suggestions[0]?.id ?? '');
  const [text, setText] = useState(issue.currentInterpretation);
  const [bounds, setBounds] = useState('');
  const [reason, setReason] = useState('');
  const resolved = issue.state !== 'UNRESOLVED';
  const blocker = issue.severity === 'BLOCKER';

  return (
    <article id={`point-${issue.id}`} tabIndex={-1} className={cn('card', !resolved && (blocker ? 'b-red' : 'b-orange'))} onMouseEnter={() => onFocusPoint(issue.pointNumber)} onMouseLeave={() => onFocusPoint(null)} onFocus={() => onFocusPoint(issue.pointNumber)}>
      <div className="row">
        <span className="pt">{t('teacher.t03.point', { n: issue.pointNumber })}</span>
        {resolved ? <StatusTag kind="pass">{t('teacher.t03.resolvedTag')}</StatusTag> : <StatusTag kind={blocker ? 'block' : 'review'}>{t(`teacher.t03.severity.${issue.severity}`)}</StatusTag>}
      </div>
      <div className="well s15 m">{issue.bubble}</div>
      {issue.currentInterpretation ? (
        <p className="s13 sec">
          <b>{t('teacher.t03.current')}</b> {issue.currentInterpretation}
        </p>
      ) : null}
      {resolved ? (
        <>
          {issue.resolution?.text ? <p className="s13">{issue.resolution.text}</p> : null}
          {issue.resolvedBy ? <p className="small muted">{t('teacher.t03.resolvedBy', { who: issue.resolvedBy, when: issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString(i18n.language) : '' })}</p> : null}
          <button type="button" className="lnk jump self-start" onClick={() => onResolve({ action: 'REOPEN' })}>{t('teacher.t03.reopen')}</button>
        </>
      ) : (
        <>
          {issue.suggestions.length > 0 ? (
            <>
              <p className="small b sec">{t('teacher.t03.suggestions')}</p>
              <div className="stack" role="radiogroup" aria-label={t('teacher.t03.suggestions')}>
                {issue.suggestions.map((s) => (
                  <Pick key={s.id} name={`suggestion-${issue.id}`} value={s.id} checked={suggestion === s.id} onSelect={setSuggestion}>
                    <span className="block">{s.text}</span>
                    <span className="small muted">{s.sourceRef}</span>
                  </Pick>
                ))}
              </div>
            </>
          ) : null}
          <div className="row">
            <button type="button" className="btn primary sm" disabled={pending} onClick={() => onResolve({ action: 'CONFIRM' })}>{t('teacher.t03.confirm')}</button>
            {issue.suggestions.length > 0 ? <button type="button" className="btn secondary sm" disabled={pending} onClick={() => onResolve({ action: 'USE_SUGGESTION', suggestionId: suggestion })}>{t('teacher.t03.useSuggestion')}</button> : null}
            <button type="button" className="btn secondary sm" onClick={() => setMode('adjust')}>{t('teacher.t03.adjust')}</button>
          </div>
          <div className="row">
            <span className="muted">{t('teacher.t03.or')}</span>
            <button type="button" className="lnk jump" onClick={() => setMode('keepOpen')}>{t('teacher.t03.keepOpen')}</button>
            <span className="muted">·</span>
            <button type="button" className="lnk red jump" onClick={() => setMode('exclude')}>{t('teacher.t03.exclude')}</button>
          </div>
          {mode === 'adjust' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor={`adjust-${issue.id}`}>{t('teacher.t03.adjustLabel')}</label>
                <textarea id={`adjust-${issue.id}`} className="textarea" value={text} onChange={(event) => setText(event.target.value)} />
              </div>
              {text !== issue.currentInterpretation ? (
                <>
                  <DiffRow kind="del">{issue.currentInterpretation}</DiffRow>
                  <DiffRow kind="add">{text}</DiffRow>
                  <p className="small muted">{t('teacher.t03.teacherReading')}</p>
                </>
              ) : null}
              <button type="button" className="btn primary sm self-start" disabled={!text.trim() || pending} onClick={() => onResolve({ action: 'EDIT', text })}>{t('teacher.t03.save')}</button>
            </div>
          ) : null}
          {mode === 'keepOpen' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor={`bounds-${issue.id}`}>{t('teacher.t03.bounds')}</label>
                <input id={`bounds-${issue.id}`} className="input" value={bounds} onChange={(event) => setBounds(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`why-${issue.id}`}>{t('teacher.t03.why')}</label>
                <input id={`why-${issue.id}`} className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
              <button type="button" className="btn primary sm self-start" disabled={!bounds.trim() || !reason.trim() || pending} onClick={() => onResolve({ action: 'KEEP_OPEN', keepOpenBounds: bounds, keepOpenReason: reason })}>{t('teacher.t03.save')}</button>
            </div>
          ) : null}
          {mode === 'exclude' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor={`exclude-${issue.id}`}>{t('teacher.t03.excludeReason')}</label>
                <input id={`exclude-${issue.id}`} className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
              <button type="button" className="btn danger sm self-start" disabled={!reason.trim() || pending} onClick={() => onResolve({ action: 'EXCLUDE', excludeReason: reason })}>{t('teacher.t03.excludeConfirm')}</button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

export function ClarifyPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const queryClient = useQueryClient();
  const [litPoint, setLitPoint] = useState<number | null>(null);
  const review = useQuery({ queryKey: qk.sourceReview(id), queryFn: () => getSourceReview(id) });

  const resolve = useMutation({
    mutationFn: ({ issueId, req }: { issueId: string; req: Resolution }) => resolveIssue(id, issueId, { ...req, baseVersion: review.data!.version } as ResolveIssueReq, newKey()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.sourceReview(id) }),
  });

  if (review.isError || (review.data && review.data.issues.length === 0 && review.data.material.paragraphs.length === 0)) return <RestartAnalysis lessonId={id} />;
  if (!review.data) return <p className="muted">{t('common.loading')}</p>;

  const { issues, material, blockersRemaining } = review.data;
  const open = issues.filter((i) => i.state === 'UNRESOLVED');
  const reviewCount = open.filter((i) => i.severity === 'REVIEW').length;
  const firstBlocker = open.find((i) => i.severity === 'BLOCKER');
  const pointsOf = (paragraphId: string) => issues.filter((i) => i.spans.some((s) => s.paragraphId === paragraphId));

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t03.crumb')}</span>
      </nav>
      <Stepper current={1} />
      <div className="stack">
        <h1 className="h1">{t('teacher.t03.title')}</h1>
        <p className="lede">{t('teacher.t03.lede', { count: issues.length })}</p>
      </div>
      <div className="row">
        {blockersRemaining > 0 ? (
          <button type="button" className="jump" title={t('teacher.t03.next')} onClick={() => document.getElementById(`point-${firstBlocker?.id}`)?.focus()}>
            <StatusTag kind="block">{t('teacher.t03.blockers', { count: blockersRemaining })}</StatusTag>
          </button>
        ) : null}
        {reviewCount > 0 ? <StatusTag kind="review">{t('teacher.t03.review', { count: reviewCount })}</StatusTag> : null}
        <StatusTag kind="pass">{t('teacher.t03.resolved', { count: issues.length - open.length })}</StatusTag>
        <span className="sp" />
        <span className="s13 muted">{t('teacher.t03.alwaysShown')}</span>
      </div>
      {resolve.isError ? <Note kind="err">{t(errorKey(resolve.error instanceof ApiError ? resolve.error.code : ''))}</Note> : null}
      <div className="cols l400">
        <div className="card sticky">
          <div className="row">
            <h3 className="s15 b">{t('teacher.t03.material')}</h3>
            <span className="sp" />
            <span className="tag neutral">{material.fileName}</span>
          </div>
          {material.paragraphs.map((paragraph) => {
            const points = pointsOf(paragraph.id);
            if (points.length === 0) return <p key={paragraph.id} className="s13">{paragraph.text}</p>;
            const blocked = points.some((p) => p.severity === 'BLOCKER' && p.state === 'UNRESOLVED');
            return (
              <div key={paragraph.id} data-testid={`paragraph-${paragraph.id}`} className={cn('note src-pt flex-col', blocked ? 'err' : 'warn', points.some((p) => p.pointNumber === litPoint) && 'lit')}>
                <span className="small b">{points.map((p) => t('teacher.t03.point', { n: p.pointNumber })).join(', ')}</span>
                <span>{paragraph.text}</span>
              </div>
            );
          })}
          <p className="small muted">{t('teacher.t03.unchanged')}</p>
        </div>
        <div className="stack">
          {issues.map((issue) => (
            <IssueCard key={`${issue.id}-${issue.state}`} issue={issue} pending={resolve.isPending} onFocusPoint={setLitPoint} onResolve={(req) => resolve.mutate({ issueId: issue.id, req })} />
          ))}
        </div>
      </div>
      <div className="card tight dock">
        <div className="row">
          {blockersRemaining > 0 ? <span className="s13 sec">{t('teacher.t03.blocked')}</span> : null}
          <span className="sp" />
          {blockersRemaining > 0 ? (
            <button type="button" className="btn primary" disabled>{t('teacher.t03.continue')}</button>
          ) : (
            <Link to="/t/lessons/$id/source" params={{ id }} className="btn primary">{t('teacher.t03.continue')}</Link>
          )}
        </div>
      </div>
    </>
  );
}
