import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const PAGES: Record<string, string> = {
  '/': 'entry.title',
  '/privacy': 'teacher.shell.privacy',
  '/quyen-rieng-tu': 'teacher.shell.privacy',
  '/terms': 'teacher.shell.terms',
  '/dieu-khoan': 'teacher.shell.terms',
  '/accessibility': 'teacher.shell.accessibility',
  '/tro-nang': 'teacher.shell.accessibility',
  '/t/lessons': 'lessons.title',
  '/t/lessons/new': 'teacher.t01.crumb',
  '/t/lessons/$id/analyze': 'teacher.t02.crumb',
  '/t/lessons/$id/clarify': 'teacher.t03.crumb',
  '/t/lessons/$id/source': 'teacher.t05.title',
  '/t/lessons/$id/source/edit': 'teacher.t10.title',
  '/t/lessons/$id/tasks': 'teacher.t06.title',
  '/t/lessons/$id/tasks/$slot/logic': 'teacher.t08.title',
  '/t/lessons/$id/approve': 'teacher.t12.title',
  '/t/lessons/$id/assign': 'teacher.t13.title',
  '/t/assignments/$id': 'teacher.t14.title',
  '/t/attempts/$id/trace/$slot': 'titles.trace',
  '/s/thong-bao': 'consent.title',
  '/s/assignments': 'student.home.title',
  '/s/attempts/$id/results': 'titles.results',
  '/s/attempts/$id/results/$slot': 'titles.results',
};

/** Teacher and student views sit in tabs side by side, so each tab says which side and which screen it is. */
export function usePageTitle(): void {
  const { t, i18n } = useTranslation();
  const match = useRouterState({ select: (state) => state.matches[state.matches.length - 1] });
  const routeId = match?.routeId as string | undefined;
  const slot = (match?.params as { slot?: string } | undefined)?.slot;

  useEffect(() => {
    if (!routeId) return;
    const key = routeId === '/s/attempts/$id/$slot' ? `student.progress.${slot}` : routeId === '/t/lessons/$id/tasks/$slot' ? `teacher.taskType.${slot}` : PAGES[routeId];
    const side = routeId.startsWith('/t/') ? t('titles.teacher') : routeId.startsWith('/s/') ? t('titles.student') : null;
    document.title = [key ? t(key) : null, side, 'LOGINA'].filter(Boolean).join(' · ');
  }, [i18n.language, routeId, slot, t]);
}
