import { Toast } from '@/components/logina/Toast';
import { Outlet, createRootRoute, createRoute, createRouter, useNavigate, useParams } from '@tanstack/react-router';
import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { UpdateBar } from '@/components/logina/UpdateBar';
import { startUpdateChecks } from '@/lib/app-version';
import { LoadingSkeleton } from '@/components/logina/LoadingSkeleton';
import { useSessionLocale } from '@/lib/use-session-locale';
import { EntryPage } from '@/features/entry/EntryPage';

/** Each side loads only its own code, so a student never downloads the teacher screens. */
function screen<K extends string, P extends object>(load: () => Promise<Record<K, ComponentType<P>>>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const TeacherShell = screen(() => import('@/components/logina/TeacherShell'), 'TeacherShell');
const LegalPage = screen(() => import('@/features/legal/LegalPage'), 'LegalPage');
const ApprovePage = screen(() => import('@/features/approve/ApprovePage'), 'ApprovePage');
const AssignPage = screen(() => import('@/features/approve/AssignPage'), 'AssignPage');
const AnalyzePage = screen(() => import('@/features/lessons/AnalyzePage'), 'AnalyzePage');
const CreateLesson = screen(() => import('@/features/lessons/CreateLesson'), 'CreateLesson');
const LessonRedirect = screen(() => import('@/features/lessons/LessonRedirect'), 'LessonRedirect');
const LessonsHome = screen(() => import('@/features/lessons/LessonsHome'), 'LessonsHome');
const TracePage = screen(() => import('@/features/tracking/TracePage'), 'TracePage');
const TrackingPage = screen(() => import('@/features/tracking/TrackingPage'), 'TrackingPage');
const LogicPage = screen(() => import('@/features/tasks/LogicPage'), 'LogicPage');
const PreviewPage = screen(() => import('@/features/tasks/PreviewPage'), 'PreviewPage');
const TasksPage = screen(() => import('@/features/tasks/TasksPage'), 'TasksPage');
const SourceEditPage = screen(() => import('@/features/source/SourceEditPage'), 'SourceEditPage');
const ClarifyPage = screen(() => import('@/features/source/ClarifyPage'), 'ClarifyPage');
const SourcePage = screen(() => import('@/features/source/SourcePage'), 'SourcePage');
const Consent = screen(() => import('@/features/student/Consent'), 'Consent');
const OpenAssignment = screen(() => import('@/features/student/OpenAssignment'), 'OpenAssignment');
const ResultDetail = screen(() => import('@/features/student/ResultSet'), 'ResultDetail');
const ResultSet = screen(() => import('@/features/student/ResultSet'), 'ResultSet');
const StudentHome = screen(() => import('@/features/student/StudentHome'), 'StudentHome');
const TaskRunner = screen(() => import('@/features/student/TaskRunner'), 'TaskRunner');

function Root() {
  useEffect(() => startUpdateChecks(), []);
  return (
    <>
      <UpdateBar />
      <Outlet />
      <Toast />
    </>
  );
}

const rootRoute = createRootRoute({ component: Root });

type Screen = ComponentType;

const page = (path: string, Content: Screen) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <Suspense fallback={<div className="p-6"><LoadingSkeleton /></div>}>
        <Content />
      </Suspense>
    ),
  });

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

export const router = createRouter({ routeTree, scrollRestoration: true });
