import type { ClassTrackingDTO, LessonDTO, TaskApprovalDTO, TasksOverviewDTO, TeacherTaskPreviewDTO, TraceDTO } from '@logina/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PairGrid } from '@/components/logina/PairGrid';
import { ApprovePage } from '@/features/approve/ApprovePage';
import { AssignPage } from '@/features/approve/AssignPage';
import { SourceEditPage } from '@/features/source/SourceEditPage';
import { PreviewPage } from '@/features/tasks/PreviewPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TracePage } from '@/features/tracking/TracePage';
import { TrackingPage } from '@/features/tracking/TrackingPage';
import * as api from '@/lib/api';
import { renderWithI18n } from './utils';

const navigate = vi.fn();
const params = { id: 'l1', slot: 'Q1' };
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  useNavigate: () => navigate,
  useParams: () => params,
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; 'aria-label'?: string }) => <a href={to} aria-label={rest['aria-label']}>{children}</a>,
}));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<object>()),
  getMe: vi.fn(async () => ({ demoMenu: false, uiLocale: 'en' })),
  getLesson: vi.fn(),
  getTasks: vi.fn(),
  getPreview: vi.fn(),
  getMyAssignments: vi.fn(async () => ({ assignments: [] })),
  getJob: vi.fn(),
  chooseSufficiency: vi.fn(),
  getChallenges: vi.fn(),
  tryCase: vi.fn(),
  sendEdit: vi.fn(),
  rerunTask: vi.fn(),
  getApproval: vi.fn(),
  retryTranslation: vi.fn(),
  editTranslation: vi.fn(),
  approveTask: vi.fn(),
  sendDisposition: vi.fn(async () => ({ ok: true })),
  assignLesson: vi.fn(),
  getClass: vi.fn(async () => ({ id: 'c', name: '12A3' })),
  getSourceDraft: vi.fn(),
  getTracking: vi.fn(),
  getTrace: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const render = (ui: React.ReactElement) =>
  renderWithI18n(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const overview = (q4: Partial<TasksOverviewDTO['slots'][number]> = {}): TasksOverviewDTO => ({
  slots: (['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const).map((slot) => ({
    slot,
    progress: 'READY',
    taskType: 'JUDGMENT_EVIDENCE',
    sufficiency: 'SUFFICIENT',
    sufficiencyNote: `Note ${slot}`,
    sourceRefs: ['p. 8'],
    draftStatus: 'MACHINE_PASS',
    ...(slot === 'Q4' ? q4 : {}),
  })) as TasksOverviewDTO['slots'],
});

const preview = (over: Partial<TeacherTaskPreviewDTO> = {}) =>
  ({
    draftId: 'd1',
    draftVersion: 3,
    status: 'REVIEW_REQUIRED',
    questionStem: 'Which statement?',
    answers: [{ id: 'A1', text: 'First', teacherLabel: 'Correct', sourceAnchor: 'p. 8' }, { id: 'A2', text: 'Second', teacherLabel: 'Wrong', sourceAnchor: 'p. 8' }],
    evidence: [{ id: 'E1', text: 'Card', teacherLabel: 'Full', relationNote: 'covers both', sourceAnchor: 'p. 8' }],
    exampleChallenges: [{ label: 'TN1', purpose: 'Direction', whenShown: 'When wrong', message: 'Look again.' }],
    gates: [{ gateId: 'QG1', status: 'PASS', explanationForTeacher: 'Fine' }],
    structureChecks: [{ label: '4 statements', status: 'PASS' }],
    blockers: 0,
    previewHash: 'h',
    candidateSetVersion: 1,
    canApprove: true,
    ...over,
  }) as TeacherTaskPreviewDTO;

const approvalTask = (slot: string, over: Partial<TaskApprovalDTO['tasks'][number]> = {}) =>
  ({ slot, status: 'MACHINE_PASS', gatesSummary: { aggregate: 'MACHINE_PASS', gates: [] }, draftVersion: 3, previewHash: 'h', candidateSetVersion: 1, missingAltTextRefs: [], changesSinceLastPreview: [], decisionsNeeded: [], acceptedWarning: false, ...over }) as TaskApprovalDTO['tasks'][number];

beforeEach(() => {
  vi.clearAllMocks();
  params.id = 'l1';
  params.slot = 'Q1';
  vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', title: 'Lesson 8', version: 5, primaryClassId: 'c', currentTaskDraftIds: {} } as unknown as LessonDTO);
  vi.mocked(api.getTasks).mockResolvedValue(overview());
  vi.mocked(api.getPreview).mockResolvedValue(preview());
});

describe('loading', () => {
  it('Tasks shows a skeleton, not an empty table, while it loads', async () => {
    vi.mocked(api.getTasks).mockImplementation(() => new Promise(() => {}));
    await render(<TasksPage />);
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('T6', () => {
  it('lists five tasks with sufficiency and source refs', async () => {
    await render(<TasksPage />);
    expect(await screen.findByText('Note Q3')).toBeInTheDocument();
    expect(screen.getAllByText('p. 8')).toHaveLength(5);
  });

  it('an uncertain Q4 shows three choices and only Q4 paused', async () => {
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: 'UNCERTAIN', draftStatus: null }));
    await render(<TasksPage />);
    expect(await screen.findByText('Q4 needs your decision')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getAllByText('Paused, waiting for you')).toHaveLength(1);
  });

  it('Approval 2 opens once all five drafts are ready', async () => {
    await render(<TasksPage />);
    expect(await screen.findByRole('link', { name: 'Go to Approval 2' })).toBeInTheDocument();
    expect(screen.queryByText(/once all 5 drafts are ready/)).toBeNull();
  });

  it('Approval 2 stays closed and says why while a draft is missing', async () => {
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: 'UNCERTAIN', draftStatus: null }));
    await render(<TasksPage />);
    expect(await screen.findByRole('button', { name: 'Go to Approval 2' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Go to Approval 2' })).toBeNull();
    expect(screen.getByText(/once all 5 drafts are ready/)).toBeInTheDocument();
  });

  it('Approval 2 stays closed while a job runs, even with five drafts', async () => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 5, aiMode: 'LIVE', activeJobId: 'j' } as unknown as LessonDTO);
    vi.mocked(api.getJob).mockResolvedValue({ id: 'j', type: 'GENERATE', status: 'RUNNING', steps: [] });
    await render(<TasksPage />);
    expect(await screen.findByRole('button', { name: 'Go to Approval 2' })).toBeDisabled();
  });

  it('source locations read as pages and paragraphs, and internal IDs are left out', async () => {
    const slots = overview().slots.map((slot) => ({ ...slot, sourceRefs: ['p1-4 · t2-1 · se_c1_0 · Table 8.1'] }));
    vi.mocked(api.getTasks).mockResolvedValue({ slots });
    await render(<TasksPage />);
    expect(await screen.findAllByText('p. 1, para. 4 · p. 2, table 1 · Table 8.1')).toHaveLength(5);
  });

  it('while a job runs, an undrafted task says Drafting and the page says how long it can take', async () => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 5, aiMode: 'LIVE', activeJobId: 'j' } as unknown as LessonDTO);
    vi.mocked(api.getJob).mockResolvedValue({ id: 'j', type: 'GENERATE', status: 'RUNNING', steps: [] });
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: null, draftStatus: null, progress: 'DRAFTING' }));
    await render(<TasksPage />);
    expect(await screen.findByText('Drafting…')).toBeInTheDocument();
    expect(await screen.findByText(/up to 15 minutes/)).toBeInTheDocument();
    expect(screen.queryByText('Paused, waiting for you')).toBeNull();
  });

  it('while a job runs, each task shows its own step and the running time', async () => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 5, aiMode: 'LIVE', activeJobId: 'j' } as unknown as LessonDTO);
    vi.mocked(api.getJob).mockResolvedValue({ id: 'j', type: 'GENERATE', status: 'RUNNING', steps: [], startedAt: new Date(Date.now() - 125_000).toISOString() });
    const slots = overview().slots.map((slot, index) => ({ ...slot, progress: (['READY', 'TRANSLATING', 'CHECKING', 'DRAFTING', 'FAILED'] as const)[index]!, draftStatus: index === 3 ? null : slot.draftStatus }));
    vi.mocked(api.getTasks).mockResolvedValue({ slots });
    await render(<TasksPage />);
    expect(await screen.findByText('Translating…')).toBeInTheDocument();
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(screen.getByText('Drafting…')).toBeInTheDocument();
    expect(screen.getByText('Could not finish')).toBeInTheDocument();
    expect(await screen.findByText(/2 min 5 s/)).toBeInTheDocument();
    expect(screen.getByText(/close this tab/)).toBeInTheDocument();
  });

  it('a task that could not finish still shows after the job ends', async () => {
    const slots = overview().slots.map((slot, index) => ({ ...slot, progress: index === 1 ? ('FAILED' as const) : ('READY' as const) }));
    vi.mocked(api.getTasks).mockResolvedValue({ slots });
    await render(<TasksPage />);
    expect(await screen.findByText('Could not finish')).toBeInTheDocument();
  });

  it('a job that timed out says so, and the unfinished task can be regenerated', async () => {
    vi.mocked(api.getLesson).mockResolvedValueOnce({ id: 'l1', version: 5, aiMode: 'LIVE', activeJobId: 'j' } as unknown as LessonDTO);
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 6, aiMode: 'LIVE' } as unknown as LessonDTO);
    vi.mocked(api.getJob).mockResolvedValue({ id: 'j', type: 'GENERATE', status: 'TIMED_OUT', steps: [], errorCode: 'TIMED_OUT' });
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: null, draftStatus: null }));
    await render(<TasksPage />);
    expect(await screen.findByText(/took too long/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Regenerate Q4 with this choice' })).toBeInTheDocument();
    expect(screen.getByText('Paused, waiting for you')).toBeInTheDocument();
    expect(screen.getByText('Not checked')).toBeInTheDocument();
  });

  it('a choice sends the lesson version', async () => {
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: 'UNCERTAIN', draftStatus: null }));
    vi.mocked(api.chooseSufficiency).mockResolvedValue({ id: 'j' } as never);
    await render(<TasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Q4 with this choice' }));
    await waitFor(() => expect(api.chooseSufficiency).toHaveBeenCalledWith('l1', 'Q4', { choice: 'REFOCUS', baseVersion: 5 }, expect.any(String)));
  });
});

describe('T12 translation', () => {
  const translation = (over: object = {}) => ({ status: 'READY', locale: 'vi', version: 2, texts: [{ from: 'Which statement?', to: 'Nhận định nào?' }], keywords: {}, findings: [], ...over });
  const showing = (slot: string, value: object | undefined) => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 5, aiMode: 'LIVE' } as unknown as LessonDTO);
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask(slot, value ? { translation: value } as never : {})], contentManifestHash: '', canApprove: true } as never);
  };

  it('shows both languages side by side', async () => {
    showing('Q1', translation());
    await render(<ApprovePage />);
    expect(await screen.findByText('Which statement?')).toBeInTheDocument();
    expect(screen.getByText('Nhận định nào?')).toBeInTheDocument();
  });

  it('a long translation keeps its lines in one scrollable box', async () => {
    showing('Q1', translation());
    await render(<ApprovePage />);
    const box = await screen.findByRole('region', { name: 'Lines in Q1' });
    expect(box).toHaveAttribute('tabindex', '0');
    expect(box).toHaveTextContent('Which statement?');
    expect(screen.getByText('1 line')).toBeInTheDocument();
  });

  it('a failed translation can be retried, and the task cannot be approved', async () => {
    showing('Q1', translation({ status: 'FAILED', texts: [] }));
    vi.mocked(api.retryTranslation).mockResolvedValue({ id: 'j' } as never);
    await render(<ApprovePage />);
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Approve Q1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry translation' }));
    await waitFor(() => expect(api.retryTranslation).toHaveBeenCalledWith('l1', 'Q1', expect.any(String)));
  });

  it('a blocked translation shows why and stops approval', async () => {
    showing('Q1', translation({ status: 'BLOCKED', findings: [{ status: 'BLOCKER', findingCode: 'NUMBER_CHANGED', text: 'Which statement?', explanationForTeacher: 'A number changed.' }] }));
    await render(<ApprovePage />);
    expect(await screen.findByText('A number changed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Approve Q1' })).toBeDisabled();
  });

  it('a teacher can edit one translated line', async () => {
    showing('Q1', translation());
    vi.mocked(api.editTranslation).mockResolvedValue({ id: 'j' } as never);
    await render(<ApprovePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit translation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Which statement?' }), { target: { value: 'Câu nào đúng?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and recheck' }));
    await waitFor(() => expect(api.editTranslation).toHaveBeenCalledWith('l1', 'Q1', { from: 'Which statement?', to: 'Câu nào đúng?', translationVersion: 2 }, expect.any(String)));
  });

  it('a blocked or stuck translation can be retried', async () => {
    showing('Q1', translation({ status: 'BLOCKED' }));
    const { unmount } = await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Retry translation' })).toBeInTheDocument();
    unmount();
    showing('Q1', translation({ status: 'WORKING', stuck: true }));
    await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Retry translation' })).toBeInTheDocument();
  });

  it('Q5 shows the keywords for review', async () => {
    showing('Q5', translation({ keywords: { training: ['đào tạo', 'kỹ năng'] } }));
    await render(<ApprovePage />);
    expect(await screen.findByText('đào tạo, kỹ năng')).toBeInTheDocument();
  });

  it('approval sends the translation version', async () => {
    showing('Q1', translation());
    vi.mocked(api.approveTask).mockResolvedValue({ taskReleaseId: 'r', releaseLabel: 'r1' });
    await render(<ApprovePage />);
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve Q1' }));
    await waitFor(() => expect(api.approveTask).toHaveBeenCalledWith('l1', 'Q1', expect.objectContaining({ translationVersion: 2 }), expect.any(String)));
  });

  it('an upload with no translation yet offers a retry, and the sample lesson shows nothing', async () => {
    showing('Q1', undefined);
    const { unmount } = await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Retry translation' })).toBeInTheDocument();
    unmount();
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', version: 5, aiMode: 'SEEDED' } as unknown as LessonDTO);
    await render(<ApprovePage />);
    await screen.findByRole('button', { name: 'Approve Q1' });
    expect(screen.queryByRole('button', { name: 'Retry translation' })).toBeNull();
  });
});

describe('T7, T9 and T11', () => {
  it('Go to Approval 2 shows the remaining count', async () => {
    vi.mocked(api.getTasks).mockResolvedValue(overview({ draftStatus: 'BLOCKED' }));
    await render(<PreviewPage />);
    expect(await screen.findByRole('link', { name: /Go to Approval 2\s*1/ })).toBeInTheDocument();
  });

  it('quick edit has an accessible name per option', async () => {
    await render(<PreviewPage />);
    expect(await screen.findByRole('button', { name: 'Quick edit A1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick edit A2' })).toBeInTheDocument();
  });

  it('structure checks are listed apart from the quality gates', async () => {
    await render(<PreviewPage />);
    expect(await screen.findByText('STRUCTURE CHECKS')).toBeInTheDocument();
    expect(screen.getByText('QUALITY CHECKS')).toBeInTheDocument();
  });

  it('try a case shows the prompt without any rule detail', async () => {
    vi.mocked(api.tryCase).mockResolvedValue({ answerId: 'A1', evidenceId: 'E1', wouldReceive: { label: 'TN2', purpose: 'Enough', message: 'Is it enough?' } });
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'A1' }));
    fireEvent.click(screen.getByRole('button', { name: 'E1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show the prompt' }));
    expect(await screen.findByText('Is it enough?')).toBeInTheDocument();
    expect(screen.getByText('Shows only the prompt the student gets, not the selection rules.')).toBeInTheDocument();
  });

  it('while rechecking the banner shows and edits are locked', async () => {
    vi.mocked(api.getPreview).mockResolvedValue(preview({ status: 'VALIDATING' }));
    await render(<PreviewPage />);
    expect(await screen.findByText('The preview is outdated because you just edited it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quick edit A1' })).toBeDisabled();
  });

  it('a recheck resumes from activeJobId', async () => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', activeJobId: 'j1', currentTaskDraftIds: {} } as unknown as LessonDTO);
    vi.mocked(api.getJob).mockResolvedValue({ id: 'j1', type: 'RERUN', status: 'RUNNING', steps: [] } as never);
    await render(<PreviewPage />);
    await waitFor(() => expect(api.getJob).toHaveBeenCalledWith('j1'));
  });

  it('a new fact in a quick edit shows the three actions', async () => {
    vi.mocked(api.sendEdit).mockRejectedValue(new api.ApiError(409, 'NEEDS_SOURCE_ROUTE'));
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quick edit A1' }));
    fireEvent.change(screen.getByLabelText('Quick edit A1', { selector: 'textarea' }), { target: { value: 'Fell by 5%' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and recheck' }));
    expect(await screen.findByText("Couldn't save Quick edit")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit source (Approval 1 again)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revert to the previous wording' })).toBeInTheDocument();
  });

  it('a conflict says someone else saved first and offers to copy', async () => {
    vi.mocked(api.sendEdit).mockRejectedValue(new api.ApiError(409, 'VERSION_CONFLICT'));
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quick edit A1' }));
    fireEvent.change(screen.getByLabelText('Quick edit A1', { selector: 'textarea' }), { target: { value: 'New' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and recheck' }));
    expect(await screen.findByText('Someone else saved first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy your wording' })).toBeInTheDocument();
  });

  it('FAILED shows Try again and never the old pass, and Try again posts a rerun', async () => {
    vi.mocked(api.getPreview).mockResolvedValue(preview({ status: 'FAILED' }));
    vi.mocked(api.rerunTask).mockResolvedValue({ id: 'j' } as never);
    await render(<PreviewPage />);
    expect((await screen.findAllByText('Check failed')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.rerunTask).toHaveBeenCalledWith('l1', 'Q1', expect.any(String)));
  });

  it('a Q2 to Q5 summary has example prompts and no edit controls', async () => {
    params.slot = 'Q2';
    vi.mocked(api.getPreview).mockResolvedValue({ slot: 'Q2', draftId: 'd', draftVersion: 2, taskType: 'EVIDENCE_RANKING', status: 'MACHINE_PASS', questionStem: 'Rank', gates: [], exampleChallenges: preview().exampleChallenges, blockers: 0, canApprove: true, taskBody: { cards: [{ cardId: 'K1', text: 'Card one' }], basis: 'b', teacherLabels: { K1: 'Strongest' } } } as never);
    await render(<PreviewPage />);
    expect(await screen.findByText('Card one')).toBeInTheDocument();
    expect(screen.getByText('Strongest')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quick edit/ })).toBeNull();
  });

  it('a blocked task opens its prompts with an inline editor, and fallback cannot be edited', async () => {
    params.slot = 'Q4';
    vi.mocked(api.getPreview).mockResolvedValue({ slot: 'Q4', draftId: 'd4', draftVersion: 3, taskType: 'COUNTERARGUMENT', status: 'BLOCKED', questionStem: 'Rebut', gates: [], exampleChallenges: preview().exampleChallenges, blockers: 1, canApprove: false, taskBody: { templates: [], teacherLabels: {} } } as never);
    vi.mocked(api.getChallenges).mockResolvedValue({ slot: 'Q4', draftVersion: 3, candidateSetVersion: 1, challenges: [
      { challengeId: 'TN2', label: 'TN2', purpose: 'Enough', whenShown: 'x', message: 'Productivity rose.', isFallback: false, sourceAnchor: 'p. 8' },
      { challengeId: 'FB', label: 'Fallback', purpose: 'Neutral', whenShown: 'y', message: 'Check once more.', isFallback: true, sourceAnchor: 'p. 8' },
    ] });
    vi.mocked(api.sendEdit).mockResolvedValue({ editId: 'e', newDraftIds: [], staleDraftIds: [], jobId: 'j' });
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit TN2' }));
    expect(screen.queryByRole('button', { name: 'Edit Fallback' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Edit TN2', { selector: 'textarea' }), { target: { value: 'What else would you need to know?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and recheck' }));
    await waitFor(() => expect(api.sendEdit).toHaveBeenCalledWith('l1', { editScope: 'LOGIC', targetType: 'challenge', targetId: 'd4', changedRefs: ['TN2'], baseVersion: 3, payload: { challengeId: 'TN2', message: 'What else would you need to know?' } }, expect.any(String)));
  });

  it('View all prompts opens the full list', async () => {
    vi.mocked(api.getChallenges).mockResolvedValue({ slot: 'Q1', draftVersion: 3, candidateSetVersion: 1, challenges: [{ challengeId: 'FB', label: 'FB', purpose: 'Fallback', whenShown: 'Otherwise', message: 'Check once more.', isFallback: true, sourceAnchor: 'p. 8' }] });
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'View all prompts' }));
    expect(await screen.findByText('Check once more.')).toBeInTheDocument();
  });
});

describe('T8 pair grid', () => {
  it('renders 16 cells with relation, reason and target', async () => {
    const pairs = ['A1', 'A2', 'A3', 'A4'].flatMap((answerId) => ['E1', 'E2', 'E3', 'E4'].map((evidenceId) => ({ answerId, evidenceId, relationLabel: 'Partial', explanation: `${answerId}${evidenceId}`, goesTo: 'TN1' })));
    await render(<PairGrid pairs={pairs} />);
    expect(screen.getAllByText('TN1')).toHaveLength(16);
    expect(screen.getByText('A3E2')).toBeInTheDocument();
  });
});

describe('T10', () => {
  it('shows before and after, impact and unchanged releases', async () => {
    vi.mocked(api.getSourceDraft).mockResolvedValue({ sourceModelDraftId: 'd', version: 2, editedClaims: [{ claimId: 'c', before: 'Old claim', after: 'New claim', evidence: 'Table' }], impact: [{ slot: 'Q1', usesClaim: true, refs: ['A1'] }, { slot: 'Q2', usesClaim: false, refs: [] }], unaffectedSlots: ['Q2'], assignedReleasesUnchanged: [{ classLabel: '12A3', releaseLabel: 'r4' }], approveReady: true });
    await render(<SourceEditPage />);
    expect(await screen.findByText('Old claim')).toBeInTheDocument();
    expect(screen.getByText('New claim')).toBeInTheDocument();
    expect(screen.getByText('Yes · A1')).toBeInTheDocument();
    expect(screen.getByText(/12A3 r4/)).toBeInTheDocument();
  });
});

describe('T12 and T13', () => {
  const finding = { gateId: 'QG1', findingCode: 'TREND', explanationForTeacher: 'May be too easy', overridable: true } as const;

  it('a draft still missing shows the way back, not an error', async () => {
    vi.mocked(api.getApproval).mockRejectedValue(new api.ApiError(409, 'TASKS_NOT_READY'));
    await render(<ApprovePage />);
    expect(await screen.findByText(/Every task needs a draft/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the tasks' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
  });

  it('a check has a plain name, not a code', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { decisionsNeeded: [finding] })], contentManifestHash: 'h', canApprove: true });
    await render(<ApprovePage />);
    expect(await screen.findByText('Teaching goal')).toBeInTheDocument();
    expect(screen.queryByText('QG1')).toBeNull();
  });

  it('the reason box opens only when the teacher chooses to accept', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { decisionsNeeded: [finding] })], contentManifestHash: 'h', canApprove: true });
    await render(<ApprovePage />);
    expect(await screen.findByText('May be too easy')).toBeInTheDocument();
    expect(screen.queryByLabelText('Accept warning, give a reason')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept with a reason' }));
    expect(screen.getByLabelText('Accept warning, give a reason')).toBeInTheDocument();
  });

  it('the same warning on one check appears once, and the decision covers both', async () => {
    const twin = { ...finding, findingCode: 'CLUE' };
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { decisionsNeeded: [finding, twin] })], contentManifestHash: 'h', canApprove: true });
    await render(<ApprovePage />);
    expect(await screen.findAllByText('May be too easy')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Accept with a reason' }));
    fireEvent.change(screen.getByLabelText('Accept warning, give a reason'), { target: { value: 'Fits' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
    await waitFor(() => expect(api.sendDisposition).toHaveBeenCalledTimes(2));
    expect(api.sendDisposition).toHaveBeenCalledWith('l1', 'Q1', expect.objectContaining({ findingCode: 'TREND' }), expect.any(String));
    expect(api.sendDisposition).toHaveBeenCalledWith('l1', 'Q1', expect.objectContaining({ findingCode: 'CLUE' }), expect.any(String));
  });

  it('a warning needs a reason, and approve waits for it', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { decisionsNeeded: [finding] }), approvalTask('Q2'), approvalTask('Q3'), approvalTask('Q4'), approvalTask('Q5')], contentManifestHash: 'h', canApprove: false });
    await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Approve Q1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Accept with a reason' }));
    const save = screen.getByRole('button', { name: 'Save decision' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Accept warning, give a reason'), { target: { value: 'Fits' } });
    fireEvent.click(save);
    await waitFor(() => expect(api.sendDisposition).toHaveBeenCalledWith('l1', 'Q1', { decision: 'TEACHER_ACCEPT_WITH_REASON', gateId: 'QG1', findingCode: 'TREND', reason: 'Fits', baseVersion: 3 }, expect.any(String)));
  });

  it('a blocker cannot be accepted, only opened to fix', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { status: 'BLOCKED', gatesSummary: { aggregate: 'BLOCKED', gates: [{ gateId: 'QG5', status: 'BLOCKER', explanationForTeacher: 'Gives away the answer' }] } }), approvalTask('Q2'), approvalTask('Q3'), approvalTask('Q4'), approvalTask('Q5')], contentManifestHash: 'h', canApprove: false });
    await render(<ApprovePage />);
    expect(await screen.findByRole('link', { name: 'Open to fix' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save decision' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve Q1' })).toBeDisabled();
  });

  it('approving needs the confirmation tick and sends the seen version', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((slot) => approvalTask(slot)), contentManifestHash: 'h', canApprove: true });
    vi.mocked(api.approveTask).mockResolvedValue({ taskReleaseId: 'r', releaseLabel: 'r3' });
    await render(<ApprovePage />);
    const approve = await screen.findByRole('button', { name: 'Approve Q1' });
    expect(approve).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(approve);
    await waitFor(() => expect(api.approveTask).toHaveBeenCalledWith('l1', 'Q1', { expectedDraftVersion: 3, previewHash: 'h', candidateSetVersion: 1, confirmed: true }, expect.any(String)));
  });

  it('a disabled Approve says what it is waiting for', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((slot) => approvalTask(slot)), contentManifestHash: 'h', canApprove: true });
    await render(<ApprovePage />);
    expect(await screen.findByText('Tick the box to confirm.')).toBeInTheDocument();
    expect(screen.getByText('Approve every task to assign.')).toBeInTheDocument();
  });

  it('Assign stays disabled until all five are approved', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { approvedAt: '2026-10-31T00:00:00.000Z', releaseLabel: 'r4' }), approvalTask('Q2'), approvalTask('Q3'), approvalTask('Q4'), approvalTask('Q5')], contentManifestHash: 'h', canApprove: true });
    await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Assign · 1/5' })).toBeDisabled();
    expect(screen.getByText('r4')).toBeInTheDocument();
  });

  it('T13 assigns with no student count and goes to tracking', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((slot) => approvalTask(slot, { releaseLabel: 'r2' })), contentManifestHash: 'h', canApprove: true });
    vi.mocked(api.assignLesson).mockResolvedValue({ assignmentId: 'asg1', revision: 1, releaseLabels: {} } as never);
    await render(<AssignPage />);
    expect(await screen.findByText('12A3')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ students/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/assignments/$id', params: { id: 'asg1' } }));
    expect(vi.mocked(api.assignLesson).mock.calls[0]?.[1]).toEqual({ classId: 'c', baseVersion: 5 });
  });
});

describe('T14 and T15', () => {
  const tracking = {
    assignmentId: 'a',
    revision: 1,
    releaseLabels: { Q1: 'r4', Q2: 'r2', Q3: 'r2', Q4: 'r4', Q5: 'r3' },
    counts: { started: 8, complete: 8 },
    participants: [
      { attemptId: 'att1', participantCode: 'P-7K2M', isSimulated: false, status: 'COMPLETE', submittedCount: 5, keepCount: 4, reviseCount: 1, confidenceBefore: 70, confidenceAfter: 82 },
      { attemptId: 'att2', isSimulated: false, status: 'COMPLETE', submittedCount: 5, keepCount: 5, reviseCount: 0 },
    ],
    perTask: [{ slot: 'Q1', submitted: 8, keep: 4, revise: 4, avgConfidenceBefore: 68, avgConfidenceAfter: 76, deliveredChallenges: [{ label: 'TN1', message: 'Compare the figures.', count: 3, revised: 1 }, { label: 'TN2', message: 'Check the card.', count: 2, revised: 2 }] }],
    q1Relations: { releaseLabel: 'r4', denominator: 8, before: { full: 2, partial: 2, contradicts: 3, irrelevant: 1 }, after: { full: 5, partial: 1, contradicts: 2, irrelevant: 0 } },
  } as unknown as ClassTrackingDTO;

  it('shows codes, N started and M finished, and links to the trace', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    await render(<TrackingPage />);
    expect(await screen.findByText('8 people started, 8 finished')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Students/ }));
    expect(screen.getByText('P-7K2M')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View trace' })[0]).toHaveAttribute('href', '/t/attempts/$id/trace/$slot');
  });

  it('shows keep and revise, confidence, prompts and the disclaimer', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    const { container } = await render(<TrackingPage />);
    expect(await screen.findByText('4 / 4')).toBeInTheDocument();
    expect(screen.getAllByText('68 → 76')).toHaveLength(2);
    expect(screen.getByText(/not enough to conclude that students learned better/)).toBeInTheDocument();
    const prompts = [...container.querySelectorAll('.prompt-row')].map((row) => row.textContent);
    expect(prompts).toEqual(['Q1 · TN2Check the card.2 of 2 revised', 'Q1 · TN1Compare the figures.1 of 3 revised']);
    fireEvent.click(screen.getByRole('button', { name: 'See all prompts' }));
    expect(screen.getByRole('tab', { name: /Think-again prompts/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('TN1')).toBeInTheDocument();
  });

  it('someone who declined shows Not in research', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    await render(<TrackingPage />);
    fireEvent.click(await screen.findByRole('tab', { name: /Students/ }));
    expect(screen.getByText('Not in research')).toBeInTheDocument();
  });

  it('Keep and Revise share one neutral treatment, with no status colors', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    const { container } = await render(<TrackingPage />);
    await screen.findByText('4 / 4');
    expect(screen.getByRole('img', { name: 'Q1: 4 kept, 4 revised' })).toBeInTheDocument();
    expect(container.querySelector('[role="img"] .full, [role="img"] .contra')).toBeNull();
  });

  it('a Q2 trace has no evidence card and no empty letters', async () => {
    vi.mocked(api.getTrace).mockResolvedValue({
      assignmentId: 'asg1',
      isSimulated: false,
      releaseLabel: 'r4',
      slotChips: [{ slot: 'Q1', choice: 'REVISE' }, { slot: 'Q2', choice: 'KEEP' }, { slot: 'Q3', choice: null }],
      slot: 'Q2',
      questionStem: 'Rank them',
      before: { answer: { letter: '', authoringLabel: '', text: 'Trade > Cities' }, confidence: 70, lockedAt: '2026-10-31T03:31:00.000Z', relationLabel: '' },
      challenge: { label: 'TN1', message: 'Look again.', whySelected: '', studentChoice: 'KEEP' },
      after: { answer: { letter: '', authoringLabel: '', text: 'Trade > Cities', changed: false }, confidenceBefore: 70, confidenceAfter: 82, submittedAt: '2026-10-31T03:34:00.000Z', relationLabel: '' },
    } as unknown as TraceDTO);
    await render(<TracePage />);
    expect(await screen.findAllByText('Trade > Cities')).toHaveLength(2);
    expect(screen.queryByText('Evidence card')).toBeNull();
    expect(screen.queryByText('()')).toBeNull();
    expect(screen.getByRole('link', { name: 'Q1 · Revise' })).toHaveAttribute('href', '/t/attempts/$id/trace/$slot');
    expect(screen.queryByRole('link', { name: 'Q3' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Attempt tracking' })).toBeInTheDocument();
  });

  it('the trace shows labels, the prompt, why it was chosen, changes and the disclaimer', async () => {
    vi.mocked(api.getTrace).mockResolvedValue({
      assignmentId: 'asg1',
      participantCode: 'P-7K2M',
      isSimulated: false,
      releaseLabel: 'r4',
      slotChips: [{ slot: 'Q1', choice: 'REVISE' }, { slot: 'Q2', choice: null }],
      slot: 'Q1',
      questionStem: 'Which statement?',
      before: { answer: { letter: 'B', authoringLabel: 'A2', text: 'Rises' }, evidence: { letter: 'Card C', authoringLabel: 'E3', text: 'Says rises' }, confidence: 70, lockedAt: '2026-10-31T03:31:00.000Z', relationLabel: 'Refuted' },
      challenge: { label: 'TN1', message: 'Compare the figures.', whySelected: 'runs opposite to the source', studentChoice: 'REVISE' },
      after: { answer: { letter: 'A', authoringLabel: 'A1', text: 'Falls', changed: true }, evidence: { letter: 'Card A', authoringLabel: 'E1', text: 'Says falls', changed: false }, confidenceBefore: 70, confidenceAfter: 82, submittedAt: '2026-10-31T03:34:00.000Z', relationLabel: 'Fully supports' },
    } as unknown as TraceDTO);
    await render(<TracePage />);
    expect(await screen.findByText('Compare the figures.')).toBeInTheDocument();
    expect(screen.getByText('(A2)')).toBeInTheDocument();
    expect(screen.getByText(/runs opposite to the source/)).toBeInTheDocument();
    expect(screen.getAllByText('Changed')).toHaveLength(1);
    expect(screen.getByText(/does not show why the student changed their mind/)).toBeInTheDocument();
  });
});
