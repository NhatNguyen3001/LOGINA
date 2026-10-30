import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { Stepper } from '@/components/logina/Stepper';
import { errorKey } from '@/i18n';
import { ApiError, assignLesson, getApproval, getClass, getLesson, newKey } from '@/lib/api';
import { qk } from '@/lib/query';

export function AssignPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState('');
  const key = useRef(newKey());
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  const approval = useQuery({ queryKey: qk.approval(id), queryFn: () => getApproval(id) });
  const classId = lesson.data?.primaryClassId;
  const classInfo = useQuery({ queryKey: qk.class(classId ?? 'none'), queryFn: () => getClass(classId!), enabled: Boolean(classId) });

  const assign = useMutation({
    mutationFn: () =>
      assignLesson(id, { classId: classId!, baseVersion: lesson.data!.version, ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}), ...(message.trim() ? { messageToStudents: message } : {}) }, key.current),
    onSuccess: async ({ assignmentId }) => {
      await queryClient.invalidateQueries();
      await navigate({ to: '/t/assignments/$id', params: { id: assignmentId } });
    },
  });

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
        <div className="card">
          <div className="field">
            <span className="b">{t('teacher.t01.class')}</span>
            <span>{classInfo.data?.name}</span>
          </div>
          <div className="field">
            <label htmlFor="due">{t('teacher.t13.due')}</label>
            <input id="due" type="datetime-local" className="input num" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </div>
          <p className="hint">{t('teacher.t13.noTimer')}</p>
          <div className="field">
            <label htmlFor="message">{t('teacher.t13.message')}</label>
            <textarea id="message" className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
        </div>
        <div className="card sticky">
          <h3 className="b">{t('teacher.t13.version')}</h3>
          <div className="tbl-wrap">
            <table className="t">
              <tbody>
                {approval.data?.tasks.map((task) => (
                  <tr key={task.slot}>
                    <td className="b">{task.slot}</td>
                    <td className="num">{task.releaseLabel}</td>
                    <td>{task.acceptedWarning ? <StatusTag kind="teacher">{t('teacher.t13.withReason')}</StatusTag> : <StatusTag kind="pass">{t('teacher.gate.PASS')}</StatusTag>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{t('teacher.t13.pinned')}</p>
          {assign.isError ? <Note kind="err">{t(errorKey(assign.error instanceof ApiError ? assign.error.code : ''))}</Note> : null}
          <button type="button" className="btn primary block" disabled={!lesson.data || assign.isPending} onClick={() => assign.mutate()}>{t('teacher.t13.title')}</button>
        </div>
      </div>
    </>
  );
}
