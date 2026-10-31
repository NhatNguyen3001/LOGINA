import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { getLesson } from '@/lib/api';
import { qk } from '@/lib/query';
import { stagePath } from './stage-path';

export function LessonRedirect() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false }) as { id: string };
  const lesson = useQuery({ queryKey: qk.lesson(id), queryFn: () => getLesson(id) });
  if (lesson.data) return <Navigate to={stagePath(lesson.data)} replace />;
  return lesson.isError ? <p role="alert">{t('errors.NOT_FOUND')}</p> : <LoadingSkeleton />;
}
