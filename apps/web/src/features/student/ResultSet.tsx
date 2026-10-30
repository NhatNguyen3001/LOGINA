import type { Slot, StudentFeedbackDTO } from '@logina/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { StudentShell } from '@/components/logina/StudentShell';
import { SwitchSide } from '@/components/logina/SwitchSide';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { ApiError, getFeedback, getMe } from '@/lib/api';
import { qk } from '@/lib/query';
import { errorKey } from '@/i18n';

const changed = (row: StudentFeedbackDTO) => row.choice === 'REVISE';

function useFeedback(attemptId: string) {
  return useQuery({ queryKey: qk.feedback(attemptId), queryFn: () => getFeedback(attemptId) });
}

export function ResultSet() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  useSessionLocale();
  const feedback = useFeedback(id);
  const me = useQuery({ queryKey: qk.me(), queryFn: getMe });
  const rows = feedback.data ?? [];
  const revised = rows.filter(changed).length;

  return (
    <StudentShell title={t('student.result.title')} actions={<SwitchSide to="teacher" />}>
      {feedback.isPending ? <p className="muted">{t('common.loading')}</p> : null}
      {feedback.isError ? <Note kind="info">{t(errorKey(feedback.error instanceof ApiError ? feedback.error.code : ''))}</Note> : null}
      {feedback.data ? (
        <>
          <p className="s15 sec">{t('student.result.summary', { kept: rows.length - revised, revised })}</p>
          <div className="card flush">
            <div className="tbl-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>{t('student.result.task')}</th>
                    <th>{t('student.result.after')}</th>
                    <th>{t('student.result.change')}</th>
                    <th>{t('student.result.confidence')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.slot}>
                      <td className="b">{row.slot}</td>
                      <td><span className="tag neutral">{t(changed(row) ? 'student.result.revise' : 'student.result.keep')}</span></td>
                      <td className="s13">{t(changed(row) ? 'student.result.changed' : 'student.result.noChange')}</td>
                      <td className="num">{`${row.confidenceBefore} → ${row.confidenceAfter}`}</td>
                      <td className="whitespace-nowrap">
                        <Link to="/s/attempts/$id/results/$slot" params={{ id, slot: row.slot }} className="lnk">{t('student.result.details')}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {me.data?.participantCode ? (
            <div className="card tight">
              <div className="row">
                <span className="small b sec">{t('consent.code')}</span>
                <span className="sp" />
                <span className="bb num s15">{me.data.participantCode}</span>
              </div>
              <p className="s13 sec">{t('consent.withdraw')}</p>
            </div>
          ) : null}
          <p className="small muted">{t('student.result.disclaimer')}</p>
        </>
      ) : null}
    </StudentShell>
  );
}

export function ResultDetail() {
  const { t } = useTranslation();
  const { id, slot } = useParams({ strict: false }) as { id: string; slot: Slot };
  useSessionLocale();
  const feedback = useFeedback(id);
  const row = feedback.data?.find((r) => r.slot === slot);

  return (
    <StudentShell title={slot} actions={<SwitchSide to="teacher" />}>
      <Link to="/s/attempts/$id/results" params={{ id }} className="lnk">{t('student.result.back')}</Link>
      {feedback.isPending ? <p className="muted">{t('common.loading')}</p> : null}
      {row ? (
        <>
          <div className="journey">
            <div className="card tight">
              <span className="small b muted">{t('student.result.first')}</span>
              <span className="m">{row.initial.label}</span>
              <span className="s13 sec">{row.initial.text}</span>
              <span className="s13 sec num">{t('student.result.confidenceValue', { value: row.confidenceBefore })}</span>
            </div>
            <div className="arrow" aria-hidden="true">→</div>
            <div className="card tight">
              <span className="small b text-navy">{t('student.result.think')}</span>
              <span className="s13">{row.challengeMessage}</span>
            </div>
            <div className="arrow" aria-hidden="true">→</div>
            <div className="card tight">
              <span className="small b muted">{t('student.result.final')}</span>
              <span className="m">{row.final.label}</span>
              <span className="s13 sec">{row.final.text}</span>
              <span className="s13 sec num">{t('student.result.confidenceValue', { value: row.confidenceAfter })}</span>
            </div>
          </div>
          {row.explanations.length > 0 ? (
            <div className="card">
              <h2 className="s15 b">{t('student.result.feedback')}</h2>
              <div className="stack">
                {row.explanations.map(({ optionId, relationLabel, text }) => (
                  <div key={optionId} className="row top">
                    <span className="rel none">{relationLabel}</span>
                    <span className="grow s13">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <p className="small muted">{t('student.result.disclaimerShort')}</p>
        </>
      ) : null}
    </StudentShell>
  );
}
