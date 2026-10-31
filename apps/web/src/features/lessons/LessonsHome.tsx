import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { StatusTag } from '@/components/logina/StatusTag';
import { getLessons } from '@/lib/api';
import { qk } from '@/lib/query';
import { stagePath } from './stage-path';

export function LessonsHome() {
  const { t } = useTranslation();
  const lessons = useQuery({ queryKey: qk.lessons(), queryFn: getLessons });
  return (
    <>
      <div className="row">
        <h1 className="h1">{t('lessons.title')}</h1>
        <span className="sp" />
        <Link to="/t/lessons/new" className="btn primary">{t('lessons.new')}</Link>
      </div>
      {lessons.isPending ? <LoadingSkeleton cards={3} /> : null}
      {lessons.isError ? <p role="alert">{t('errors.generic')}</p> : null}
      {lessons.data?.lessons.length === 0 ? <p className="muted">{t('lessons.empty')}</p> : null}
      <div className="stack">
        {lessons.data?.lessons.map((lesson) => (
          <Link key={lesson.id} to={stagePath(lesson)} className="card tight no-underline">
            <div className="row">
              <span className="b s15">{lesson.title}</span>
              <span className="sp" />
              {lesson.aiMode === 'LIVE' ? <StatusTag kind="info">{t('lessons.uploaded')}</StatusTag> : null}
              <StatusTag kind={lesson.stage === 'ASSIGNED' ? 'pass' : 'neutral'}>{t(`lessons.stage.${lesson.stage}`)}</StatusTag>
            </div>
            <span className="s13 muted">{lesson.primaryClassName}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
