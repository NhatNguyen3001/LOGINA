import { readableSourceRefs } from '@/lib/source-refs';
import type { SourceReviewDTO } from '@logina/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadFailed } from '@/components/logina/LoadFailed';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag, type TagKind } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { approveSource, getLesson, getMaterialViewUrl, getSourceReview, newKey } from '@/lib/api';
import { qk } from '@/lib/query';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorText } from '@/lib/errors';

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
      /** The wait screen reads the running job from this copy, so it has to be fresh when the screen opens. */
      await queryClient.fetchQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) }).catch(() => undefined);
      await navigate({ to: '/t/lessons/$id/tasks', params: { id } });
    },
  });

  const openOriginal = async () => {
    const { url } = await getMaterialViewUrl(id, review.data!.material.materialVersionId);
    window.open(url, '_blank', 'noopener');
  };

  if (!review.data) return review.isError ? <LoadFailed error={review.error} onRetry={() => void review.refetch()} /> : <LoadingSkeleton />;
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
          <div className={cardVariants({ tone: 'flush' })}>
            <div className="row p-4">
              <h3 className="s15 b">{t('teacher.t05.claims')}</h3>
            </div>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('teacher.t05.claim')}</TableHead>
                    <TableHead>{t('teacher.t05.evidence')}</TableHead>
                    <TableHead>{t('teacher.t05.location')}</TableHead>
                    <TableHead>{t('teacher.t05.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="m">{claim.wording}</TableCell>
                      <TableCell className="sec">{claim.evidenceSnippet}</TableCell>
                      <TableCell className="src">{readableSourceRefs([claim.locator], t)}</TableCell>
                      <TableCell><StatusTag kind={STATUS_KIND[claim.status]}>{t(`teacher.t05.claimStatus.${claim.status}`)}</StatusTag></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
          <div className={cardVariants()}>
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
        <div className={cn(cardVariants(), 'sticky')}>
          <h3 className="b">{t('teacher.t05.ready')}</h3>
          <div className="row"><span className={blockersRemaining === 0 ? 'ok' : 'no'}>{blockersRemaining === 0 ? '✓' : '✕'}</span><span>{t('teacher.t05.blockers', { count: blockersRemaining })}</span></div>
          <div className="row"><span className={located ? 'ok' : 'no'}>{located ? '✓' : '✕'}</span><span>{t('teacher.t05.located')}</span></div>
          {approve.isError ? <Note kind="err">{t(errorText(approve.error))}</Note> : null}
          <button type="button" className={buttonVariants({ block: true })} aria-busy={approve.isPending} disabled={!approveReady || approve.isPending} onClick={() => approve.mutate()}>{t('teacher.t05.approve')}</button>
          <p className="small muted">{t('teacher.t05.note')}</p>
          <Link to="/t/lessons/$id/clarify" params={{ id }} className={buttonVariants({ variant: 'secondary', block: true })}>{t('teacher.t05.back')}</Link>
        </div>
      </div>
    </>
  );
}
