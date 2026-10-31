import type { SourceReviewDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag, type TagKind } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { ApiError, approveSource, getMaterialViewUrl, getSourceReview, newKey } from '@/lib/api';
import { qk } from '@/lib/query';

const STATUS_KIND: Record<SourceReviewDTO['summaryClaims'][number]['status'], TagKind> = { VERIFIED: 'pass', CONTEXT_ONLY: 'neutral', INSUFFICIENT: 'review', EXCLUDED: 'stale' };

export function SourcePage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const review = useQuery({ queryKey: qk.sourceReview(id), queryFn: () => getSourceReview(id) });

  const approve = useMutation({
    mutationFn: () => approveSource(id, review.data!.version, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.lesson(id) });
      await navigate({ to: '/t/lessons/$id/tasks', params: { id } });
    },
  });

  const openOriginal = async () => {
    const { url } = await getMaterialViewUrl(id, review.data!.material.materialVersionId);
    window.open(url, '_blank', 'noopener');
  };

  if (!review.data) return <LoadingSkeleton />;
  const { summaryClaims, teacherDecisions, openGaps, excluded, approveReady, blockersRemaining, readByAI } = review.data;
  const located = summaryClaims.every((claim) => claim.locator);

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t05.title')}</span>
      </nav>
      <Stepper current={2} />
      <h1 className="h1">{t('teacher.t05.title')}</h1>
      {readByAI ? (
        <Note kind="info">
          <p>{t('teacher.t05.readByAiNotice')}</p>
          <button type="button" className="lnk jump" onClick={() => void openOriginal()}>{t('teacher.t05.openOriginal')}</button>
        </Note>
      ) : null}
      <div className="cols">
        <div className="stack">
          <div className="card flush">
            <div className="row p-4">
              <h3 className="s15 b">{t('teacher.t05.claims')}</h3>
            </div>
            <div className="tbl-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>{t('teacher.t05.claim')}</th>
                    <th>{t('teacher.t05.evidence')}</th>
                    <th>{t('teacher.t05.location')}</th>
                    <th>{t('teacher.t05.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="m">{claim.wording}</td>
                      <td className="sec">{claim.evidenceSnippet}</td>
                      <td className="src">{claim.locator}</td>
                      <td><StatusTag kind={STATUS_KIND[claim.status]}>{t(`teacher.t05.claimStatus.${claim.status}`)}</StatusTag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="row">
              <h3 className="s15 b">{t('teacher.t05.decisions')}</h3>
              <span className="sp" />
              <span className="s13 muted">{t('teacher.t05.decisionsFrom')}</span>
            </div>
            {teacherDecisions.map((decision) => (
              <div key={decision.issueId} className="row top">
                <StatusTag kind="teacher">{decision.label}</StatusTag>
                <div className="grow stack">
                  <span className="m">{decision.text}</span>
                  <span className="s13 sec">{decision.note}</span>
                </div>
              </div>
            ))}
            {openGaps.map((gap) => (
              <div key={gap.issueId} className="row top">
                <StatusTag kind="info">{t('teacher.t05.keepOpenTag')}</StatusTag>
                <div className="grow stack">
                  <span className="m">{gap.reason}</span>
                  <span className="s13 sec">{t('teacher.t05.openLimit', { bounds: gap.bounds })}</span>
                </div>
              </div>
            ))}
            {excluded.map((item) => (
              <div key={item.issueId} className="row top">
                <StatusTag kind="neutral">{t('teacher.t05.excludedTag')}</StatusTag>
                <div className="grow stack">
                  <span className="m">{item.text}</span>
                  <span className="s13 sec">{item.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card sticky">
          <h3 className="b">{t('teacher.t05.ready')}</h3>
          <div className="row"><span className={blockersRemaining === 0 ? 'ok' : 'no'}>{blockersRemaining === 0 ? '✓' : '✕'}</span><span>{t('teacher.t05.blockers', { count: blockersRemaining })}</span></div>
          <div className="row"><span className={located ? 'ok' : 'no'}>{located ? '✓' : '✕'}</span><span>{t('teacher.t05.located')}</span></div>
          {approve.isError ? <Note kind="err">{t(errorKey(approve.error instanceof ApiError ? approve.error.code : ''))}</Note> : null}
          <button type="button" className="btn primary block" disabled={!approveReady || approve.isPending} onClick={() => approve.mutate()}>{t('teacher.t05.approve')}</button>
          <p className="small muted">{t('teacher.t05.note')}</p>
          <Link to="/t/lessons/$id/clarify" params={{ id }} className="btn secondary block">{t('teacher.t05.back')}</Link>
        </div>
      </div>
    </>
  );
}
