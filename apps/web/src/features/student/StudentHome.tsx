import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StudentShell } from '@/components/logina/StudentShell';
import { StatusTag } from '@/components/logina/StatusTag';
import { SwitchSide } from '@/components/logina/SwitchSide';
import { useSessionLocale } from '@/components/logina/TeacherShell';
import { getMyAssignments, getRecordedRuns } from '@/lib/api';
import { qk } from '@/lib/query';

export function StudentHome() {
  const { t, i18n } = useTranslation();
  useSessionLocale();
  const assignments = useQuery({ queryKey: qk.myAssignments(), queryFn: getMyAssignments });
  const runs = useQuery({ queryKey: qk.recordedRuns(), queryFn: getRecordedRuns });
  return (
    <StudentShell title={t('student.home.title')} actions={<SwitchSide to="teacher" />}>
      {assignments.isPending ? <LoadingSkeleton /> : null}
      {assignments.data?.assignments.length === 0 ? <p className="muted">{t('student.home.empty')}</p> : null}
      {assignments.data?.assignments.map((item) => (
        <Link key={item.assignmentId} to="/s/assignments/$id" params={{ id: item.assignmentId }} className="card tight no-underline">
          <div className="row">
            <span className="b s15">{item.lessonTitle}</span>
            <span className="sp" />
            <StatusTag kind={item.status === 'COMPLETE' ? 'pass' : 'neutral'}>{t(`student.status.${item.status}`)}</StatusTag>
          </div>
          <span className="s13 muted">{t('student.home.from', { name: item.teacherName })}</span>
          {item.dueAt ? <span className="s13 muted">{t('student.home.due', { date: new Date(item.dueAt).toLocaleDateString(i18n.language) })}</span> : null}
          {item.messageToStudents ? <p className="s13">{item.messageToStudents}</p> : null}
        </Link>
      ))}
      <h2 className="s15 b">{t('student.home.runsTitle')}</h2>
      {runs.data?.runs.length === 0 ? <p className="muted">{t('student.home.runsEmpty')}</p> : null}
      {runs.data?.runs.map(({ attemptId, lessonTitle, run, completedAt }) => (
        <Link key={attemptId} to="/s/attempts/$id/results" params={{ id: attemptId }} className="card tight no-underline">
          <div className="row">
            <span className="b s15">{lessonTitle}</span>
            <span className="sp" />
            <span className="lnk">{t('student.home.viewRun')}</span>
          </div>
          <span className="s13 muted">{t('student.home.runLine', { run, date: new Date(completedAt).toLocaleDateString(i18n.language) })}</span>
        </Link>
      ))}
    </StudentShell>
  );
}
