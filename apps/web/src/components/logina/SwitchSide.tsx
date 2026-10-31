import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLesson, getMyAssignments } from '@/lib/api';

async function studentTarget(lessonId?: string): Promise<string> {
  const lesson = lessonId ? await getLesson(lessonId) : null;
  const assignmentId = lesson?.latestAssignmentId ?? (await getMyAssignments()).assignments[0]?.assignmentId;
  return assignmentId ? `/s/assignments/${assignmentId}` : '/s/assignments';
}

/** One session reaches both sides, so a second tab is enough. */
export function SwitchSide({ to, lessonId, block }: { to: 'student' | 'teacher'; lessonId?: string; block?: boolean }) {
  const { t } = useTranslation();
  const open = async () => {
    window.open(to === 'student' ? await studentTarget(lessonId) : '/t/lessons', '_blank', 'noopener');
  };
  const label = t(to === 'student' ? 'common.openStudentViewFull' : 'common.openTeacherViewFull');
  return (
    <button type="button" className={`btn secondary sm ${block ? 'block' : ''}`} aria-label={label} title={label} onClick={() => void open()}>
      <ExternalLink className="ico" aria-hidden="true" />
      <span>{t(to === 'student' ? 'common.openStudentView' : 'common.openTeacherView')}</span>
    </button>
  );
}
