import { Outlet, createRootRoute, createRoute, createRouter, useNavigate, useParams } from '@tanstack/react-router';
import type { ReactElement } from 'react';
import { TeacherShell, useSessionLocale } from '@/components/logina/TeacherShell';
import { usePageTitle } from '@/lib/page-title';
import { EntryPage } from '@/features/entry/EntryPage';
import { LegalPage } from '@/features/legal/LegalPage';
import { ApprovePage } from '@/features/approve/ApprovePage';
import { AssignPage } from '@/features/approve/AssignPage';
import { AnalyzePage } from '@/features/lessons/AnalyzePage';
import { CreateLesson } from '@/features/lessons/CreateLesson';
import { LessonRedirect } from '@/features/lessons/LessonRedirect';
import { LessonsHome } from '@/features/lessons/LessonsHome';
import { TracePage } from '@/features/tracking/TracePage';
import { TrackingPage } from '@/features/tracking/TrackingPage';
import { LogicPage } from '@/features/tasks/LogicPage';
import { PreviewPage } from '@/features/tasks/PreviewPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { SourceEditPage } from '@/features/source/SourceEditPage';
import { ClarifyPage } from '@/features/source/ClarifyPage';
import { SourcePage } from '@/features/source/SourcePage';
import { Consent } from '@/features/student/Consent';
import { OpenAssignment } from '@/features/student/OpenAssignment';
import { ResultDetail, ResultSet } from '@/features/student/ResultSet';
import { StudentHome } from '@/features/student/StudentHome';
import { TaskRunner } from '@/features/student/TaskRunner';

function Root() {
  usePageTitle();
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: Root });

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

function PreviewWithSession() {
  useSessionLocale();
  return <PreviewPage />;
}

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
  teacher('/t/lessons/new', () => <CreateLesson />),
  teacher('/t/lessons/$id', LessonRedirect),
  teacher('/t/lessons/$id/analyze', AnalyzePage),
  teacher('/t/lessons/$id/clarify', ClarifyPage),
  teacher('/t/lessons/$id/source', SourcePage),
  teacher('/t/lessons/$id/source/edit', SourceEditPage),
  teacher('/t/lessons/$id/tasks', TasksPage),
  page('/t/lessons/$id/tasks/$slot', PreviewWithSession),
  teacher('/t/lessons/$id/tasks/$slot/logic', LogicPage),
  teacher('/t/lessons/$id/approve', ApprovePage),
  teacher('/t/lessons/$id/assign', AssignPage),
  page('/t/assignments/$id', () => {
    const { id } = useParams({ strict: false }) as { id: string };
    return (
      <TeacherShell assignmentId={id}>
        <TrackingPage />
      </TeacherShell>
    );
  }),
  teacher('/t/attempts/$id/trace/$slot', TracePage),
  page('/s/thong-bao', ConsentPage),
  page('/s/assignments', StudentHome),
  page('/s/assignments/$id', OpenAssignment),
  page('/s/attempts/$id/results', ResultSet),
  page('/s/attempts/$id/results/$slot', ResultDetail),
  page('/s/attempts/$id/$slot', TaskRunner),
]);

export const router = createRouter({ routeTree });
