import type { Slot, StudentFeedbackDTO } from '@logina/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StudentProgress } from '@/components/logina/StudentProgress';
import { StudentShell } from '@/components/logina/StudentShell';
import { useSessionLocale } from '@/lib/use-session-locale';
import { ApiError, getFeedback, getMyAssignments, newKey, restartAttempt } from '@/lib/api';
import { qk, queryClient } from '@/lib/query';
import { errorKey } from '@/i18n';
import { useLessonTitle } from './use-lesson-title';
import { Badge } from '@/components/ui/badge';
import { cardVariants } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const changed = (row: StudentFeedbackDTO) => row.choice === 'REVISE';

const SLOTS: Slot[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

function useFeedback(attemptId: string) {
  return useQuery({ queryKey: qk.feedback(attemptId), queryFn: () => getFeedback(attemptId) });
}

export function ResultSet() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  useSessionLocale();
  const feedback = useFeedback(id);
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments });
  const current = assignments.data?.assignments.find((a) => a.attemptId === id && a.status === 'COMPLETE');
  const navigate = useNavigate();
  const restart = useMutation({
    mutationFn: (assignmentId: string) => restartAttempt(assignmentId, newKey()),
    onSuccess: async (_, assignmentId) => {
      queryClient.clear();
      await navigate({ to: '/s/assignments/$id', params: { id: assignmentId } });
    },
  });
  const rows = feedback.data ?? [];
  const revised = rows.filter(changed).length;
  const lesson = useLessonTitle(id);
  const submitted = rows.map((row) => row.slot);

  return (
    <StudentShell title={t('student.result.title')} lesson={lesson} progress={<StudentProgress slots={SLOTS.map((slot) => ({ slot, state: submitted.includes(slot) ? 'done' : 'todo' }))} />}>
      {feedback.isPending ? <LoadingSkeleton /> : null}
      {feedback.isError ? <Note kind="info">{t(errorKey(feedback.error instanceof ApiError ? feedback.error.code : ''))}</Note> : null}
      {feedback.data ? (
        <>
          <p className="s15 sec">{t('student.result.summary', { kept: rows.length - revised, revised })}</p>
          <div className={cardVariants({ tone: 'flush' })}>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('student.result.task')}</TableHead>
                    <TableHead>{t('student.result.after')}</TableHead>
                    <TableHead>{t('student.result.change')}</TableHead>
                    <TableHead>{t('student.result.confidence')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.slot}>
                      <TableCell className="b">{row.slot}</TableCell>
                      <TableCell><Badge kind="neutral">{t(changed(row) ? 'student.result.revise' : 'student.result.keep')}</Badge></TableCell>
                      <TableCell className="s13">{t(changed(row) ? 'student.result.changed' : 'student.result.noChange')}</TableCell>
                      <TableCell className="num">{`${row.confidenceBefore} → ${row.confidenceAfter}`}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link to="/s/attempts/$id/results/$slot" params={{ id, slot: row.slot }} className="lnk">{t('student.result.details')}</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
          {current ? (
            <button type="button" className={buttonVariants()} aria-busy={restart.isPending} disabled={restart.isPending} onClick={() => restart.mutate(current.assignmentId)}>
              {t('student.result.newRun')}
            </button>
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
  const lesson = useLessonTitle(id);

  return (
    <StudentShell title={t(`student.progress.${slot}`)} lesson={lesson} progress={<StudentProgress slots={SLOTS.map((item) => ({ slot: item, state: item === slot ? 'on' : 'done' }))} />}>
      <Link to="/s/attempts/$id/results" params={{ id }} className="lnk">{t('student.result.back')}</Link>
      {feedback.isPending ? <LoadingSkeleton /> : null}
      {row ? (
        <>
          <div className="journey">
            <div className={cardVariants({ tone: 'tight' })}>
              <span className="small b muted">{t('student.result.first')}</span>
              <span className="m">{row.initial.label}</span>
              <span className="s13 sec">{row.initial.text}</span>
              <span className="s13 sec num">{t('student.result.confidenceValue', { value: row.confidenceBefore })}</span>
            </div>
            <div className="arrow" aria-hidden="true">→</div>
            <div className={cardVariants({ tone: 'tight' })}>
              <span className="small b text-accent-ink">{t('student.result.think')}</span>
              <span className="s13">{row.challengeMessage}</span>
            </div>
            <div className="arrow" aria-hidden="true">→</div>
            <div className={cardVariants({ tone: 'tight' })}>
              <span className="small b muted">{t('student.result.final')}</span>
              <span className="m">{row.final.label}</span>
              <span className="s13 sec">{row.final.text}</span>
              <span className="s13 sec num">{t('student.result.confidenceValue', { value: row.confidenceAfter })}</span>
            </div>
          </div>
          {row.explanations.length > 0 ? (
            <div className={cardVariants()}>
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
