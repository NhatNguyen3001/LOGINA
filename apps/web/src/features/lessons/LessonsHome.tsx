import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { Note } from '@/components/logina/Note';
import { StatusTag } from '@/components/logina/StatusTag';
import { deleteLesson, getLessons, newKey } from '@/lib/api';
import { errorText } from '@/lib/errors';
import { qk } from '@/lib/query';
import { stagePath } from './stage-path';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Asks first and names the lesson, since a delete also removes its tasks and class results. */
function DeleteLesson({ id, title }: { id: string; title: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteLesson(id, newKey()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.lessons() });
      setAsking(false);
    },
  });

  return (
    <AlertDialog
      open={asking}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        setAsking(next);
        remove.reset();
      }}
    >
      <AlertDialogTrigger className={cn(buttonVariants({ variant: 'danger', size: 'icon' }), 'lesson-del')} aria-label={t('lessons.deleteLabel', { title })}>
        <Trash2 className="ico" aria-hidden="true" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t('lessons.deleteTitle', { title })}</AlertDialogTitle>
        <AlertDialogDescription>{t('lessons.deleteBody')}</AlertDialogDescription>
        {remove.isError ? <Note kind="err">{t(errorText(remove.error))}</Note> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{t('lessons.deleteCancel')}</AlertDialogCancel>
          <button type="button" className={buttonVariants({ variant: 'danger' })} aria-busy={remove.isPending} disabled={remove.isPending} onClick={() => remove.mutate()}>{t('lessons.deleteConfirm')}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LessonsHome() {
  const { t } = useTranslation();
  const lessons = useQuery({ queryKey: qk.lessons(), queryFn: getLessons });
  return (
    <>
      <div className="row">
        <h1 className="h1">{t('lessons.title')}</h1>
        <span className="sp" />
        <Link to="/t/lessons/new" className={buttonVariants()}>{t('lessons.new')}</Link>
      </div>
      {lessons.isPending ? <LoadingSkeleton cards={3} /> : null}
      {lessons.isError ? <p role="alert">{t('errors.generic')}</p> : null}
      {lessons.data?.lessons.length === 0 ? <p className="muted">{t('lessons.empty')}</p> : null}
      <div className="stack">
        {lessons.data?.lessons.map((lesson) => (
          <div key={lesson.id} className={cn(cardVariants({ tone: 'tight' }), 'lesson-card')}>
            <div className="row">
              <Link to={stagePath(lesson)} className="lesson-link b s15 no-underline">{lesson.title}</Link>
              <span className="sp" />
              {lesson.aiMode === 'LIVE' ? <StatusTag kind="info">{t('lessons.uploaded')}</StatusTag> : null}
              <StatusTag kind={lesson.stage === 'ASSIGNED' ? 'pass' : 'neutral'}>{t(`lessons.stage.${lesson.stage}`)}</StatusTag>
              <DeleteLesson id={lesson.id} title={lesson.title} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
