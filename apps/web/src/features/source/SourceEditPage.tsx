import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { DiffRow } from '@/components/logina/DiffRow';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { errorKey } from '@/i18n';
import { ApiError, approveSource, getSourceDraft, newKey } from '@/lib/api';
import { qk } from '@/lib/query';

export function SourceEditPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useQuery({ queryKey: qk.sourceDraft(id), queryFn: () => getSourceDraft(id) });

  const approve = useMutation({
    mutationFn: () => approveSource(id, draft.data!.version, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['lesson', id] });
      await navigate({ to: '/t/lessons/$id/tasks', params: { id } });
    },
  });

  if (!draft.data) return draft.isError ? <p className="muted">{t('errors.generic')}</p> : <LoadingSkeleton />;
  const { editedClaims, impact, assignedReleasesUnchanged, approveReady, version } = draft.data;

  return (
    <>
      <div className="row">
        <h1 className="h1">{t('teacher.t10.title')}</h1>
        <StatusTag kind="teacher">{t('teacher.t10.tag', { version })}</StatusTag>
      </div>
      <p className="lede">{t('teacher.t10.lede')}</p>
      <div className="cols">
        <div className="stack">
          {editedClaims.map((claim) => (
            <div key={claim.claimId} className="card">
              <h3 className="s15 b">{t('teacher.t10.claim')}</h3>
              <DiffRow kind="del">{claim.before}</DiffRow>
              <DiffRow kind="add">{claim.after}</DiffRow>
              <span className="s13 sec">{claim.evidence}</span>
            </div>
          ))}
          <div className="card flush">
            <h3 className="s15 b p-4">{t('teacher.t10.impact')}</h3>
            <div className="tbl-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>{t('student.result.task')}</th>
                    <th>{t('teacher.t10.uses')}</th>
                    <th>{t('teacher.t10.after')}</th>
                  </tr>
                </thead>
                <tbody>
                  {impact.map((row) => (
                    <tr key={row.slot}>
                      <td className="b">{row.slot}</td>
                      <td>{row.usesClaim ? t('teacher.t10.yes', { refs: row.refs.join(', ') }) : t('teacher.t10.no')}</td>
                      <td>{row.usesClaim ? <StatusTag kind="stale">{t('teacher.t10.regenerate')}</StatusTag> : <StatusTag kind="pass">{t('teacher.t10.keeps')}</StatusTag>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="card sticky">
          {assignedReleasesUnchanged.length > 0 ? <p className="s13">{t('teacher.t10.assigned', { releases: assignedReleasesUnchanged.map((x) => `${x.classLabel} ${x.releaseLabel}`).join(', ') })}</p> : null}
          {approve.isError ? <Note kind="err">{t(errorKey(approve.error instanceof ApiError ? approve.error.code : ''))}</Note> : null}
          <button type="button" className="btn primary block" disabled={!approveReady || approve.isPending} onClick={() => approve.mutate()}>{t('teacher.t10.approve', { version })}</button>
          <Link to="/t/lessons/$id/tasks" params={{ id }} className="btn secondary block">{t('teacher.t10.cancel')}</Link>
        </div>
      </div>
    </>
  );
}
