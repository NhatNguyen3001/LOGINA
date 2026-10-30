import { Outlet, createRootRoute, createRoute, createRouter, useNavigate, useParams } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { TeacherShell } from '@/components/logina/TeacherShell';
import { EntryPage } from '@/features/entry/EntryPage';
import { LegalPage } from '@/features/legal/LegalPage';
import { LessonRedirect } from '@/features/lessons/LessonRedirect';
import { LessonsHome } from '@/features/lessons/LessonsHome';
import { Consent } from '@/features/student/Consent';
import { OpenAssignment } from '@/features/student/OpenAssignment';
import { ResultDetail, ResultSet } from '@/features/student/ResultSet';
import { StudentHome } from '@/features/student/StudentHome';
import { TaskRunner } from '@/features/student/TaskRunner';

const rootRoute = createRootRoute({ component: Outlet });

type Screen = () => ReactElement;

const page = (path: string, component: Screen) => createRoute({ getParentRoute: () => rootRoute, path, component });

/** Wraps a screen in the teacher shell; a lesson route passes its ID so the side switch opens that lesson. */
const teacher = (path: string, Screen: Screen) =>
  page(path, () => {
    const { id } = useParams({ strict: false }) as { id?: string };
    return (
      <TeacherShell {...(id && path.startsWith('/t/lessons/') ? { lessonId: id } : {})}>
        <Screen />
      </TeacherShell>
    );
  });

function ConsentPage() {
  const navigate = useNavigate();
  return <Consent onDone={() => void navigate({ to: '/s/assignments' })} />;
}

const routeTree = rootRoute.addChildren([
  page('/', EntryPage),
  page('/privacy', () => <LegalPage doc="privacy" />),
  page('/quyen-rieng-tu', () => <LegalPage doc="privacy" />),
  page('/terms', () => <LegalPage doc="terms" />),
  page('/dieu-khoan', () => <LegalPage doc="terms" />),
  page('/accessibility', () => <LegalPage doc="accessibility" />),
  page('/tro-nang', () => <LegalPage doc="accessibility" />),
  teacher('/t/lessons', LessonsHome),
  teacher('/t/lessons/$id', LessonRedirect),
  page('/s/thong-bao', ConsentPage),
  page('/s/assignments', StudentHome),
  page('/s/assignments/$id', OpenAssignment),
  page('/s/attempts/$id/results', ResultSet),
  page('/s/attempts/$id/results/$slot', ResultDetail),
  page('/s/attempts/$id/$slot', TaskRunner),
]);

export const router = createRouter({ routeTree });
