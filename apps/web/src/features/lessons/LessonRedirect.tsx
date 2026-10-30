import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { getLesson } from '@/lib/api';
import { qk } from '@/lib/query';
import { stagePath } from './stage-path';

export function LessonRedirect() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  if (lesson.data) return <Navigate to={stagePath(lesson.data)} replace />;
  return <p role={lesson.isError ? 'alert' : undefined}>{t(lesson.isError ? 'errors.NOT_FOUND' : 'common.loading')}</p>;
}
