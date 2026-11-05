import { ErrorNote } from '@/components/logina/ErrorNote';
import { useUnsavedText } from '@/lib/unsaved';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadFailed } from '@/components/logina/LoadFailed';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { assignLesson, getApproval, getLesson, newKey } from '@/lib/api';
import { qk } from '@/lib/query';
import { useSamplePrefill } from '@/lib/sample-prefill';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

export function AssignPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dueAt, setDueAt] = useState('');
  const sampleMessage = useSamplePrefill(id)?.messageToStudents;
  const [typed, setMessage] = useState<string | null>(null);
  const message = typed ?? sampleMessage ?? '';
  useUnsavedText(typed !== null);
  const key = useRef(newKey());
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const approval = useQuery({ queryKey: qk.approval(id), queryFn: () => getApproval(id) });
  const classId = lesson.data?.primaryClassId;

  const assign = useMutation({
    mutationFn: () =>
      assignLesson(id, { classId: classId!, baseVersion: lesson.data!.version, ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}), ...(message.trim() ? { messageToStudents: message } : {}) }, key.current),
    onSuccess: async ({ assignmentId }) => {
      await queryClient.invalidateQueries();
      await navigate({ to: '/t/assignments/$id', params: { id: assignmentId } });
    },
  });

  if (lesson.isError || approval.isError) {
    return (
      <LoadFailed
        error={lesson.error ?? approval.error}
        onRetry={() => {
          void lesson.refetch();
          void approval.refetch();
        }}
      />
    );
  }
  if (!lesson.data || !approval.data) return <LoadingSkeleton />;

  return (
    <>
      <nav className="crumbs">
        <Link to="/t/lessons">{t('common.lessonSets')}</Link>
        <span>/</span>
        <span>{t('teacher.t13.title')}</span>
      </nav>
      <Stepper current={4} />
      <h1 className="h1">{t('teacher.t13.title')}</h1>
      <p className="lede">{t('teacher.t13.lede')}</p>
      <div className="cols">
        <div className={cardVariants()}>
          <div className="field">
            <label htmlFor="due">{t('teacher.t13.due')}</label>
            <Input id="due" type="datetime-local" className="num" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
          <p className="hint">{t('teacher.t13.noTimer')}</p>
          <div className="field">
            <label htmlFor="message">{t('teacher.t13.message')}</label>
            <Textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        </div>
        <div className={cn(cardVariants(), 'sticky')}>
          <h3 className="b">{t('teacher.t13.version')}</h3>
          <Table>
              <TableBody>
                {approval.data.tasks.map((task) => (
                  <TableRow key={task.slot}>
                    <TableCell className="b">{task.slot}</TableCell>
                    <TableCell className="num">{task.releaseLabel}</TableCell>
                    <TableCell>{task.acceptedWarning ? <StatusTag kind="teacher">{t('teacher.t13.withReason')}</StatusTag> : <StatusTag kind="pass">{t('teacher.gate.PASS')}</StatusTag>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          <p className="small muted">{t('teacher.t13.pinned')}</p>
          {assign.isError ? <ErrorNote error={assign.error} text={message} /> : null}
          <button type="button" className={buttonVariants({ block: true })} aria-busy={assign.isPending} disabled={assign.isPending} onClick={() => assign.mutate()}>{t('teacher.t13.title')}</button>
        </div>
      </div>
    </>
  );
}
