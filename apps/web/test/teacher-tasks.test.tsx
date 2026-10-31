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
  getLimits: vi.fn(async () => ({ limits: [] })),
  getMyAssignments: vi.fn(async () => ({ assignments: [] })),
  getJob: vi.fn(),
  chooseSufficiency: vi.fn(),
  getChallenges: vi.fn(),
  tryCase: vi.fn(),
  sendEdit: vi.fn(),
  rerunTask: vi.fn(),
  getApproval: vi.fn(),
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

  it('a choice sends the lesson version', async () => {
    vi.mocked(api.getTasks).mockResolvedValue(overview({ sufficiency: 'UNCERTAIN', draftStatus: null }));
    vi.mocked(api.chooseSufficiency).mockResolvedValue({ id: 'j' } as never);
    await render(<TasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Q4 with this choice' }));
    await waitFor(() => expect(api.chooseSufficiency).toHaveBeenCalledWith('l1', 'Q4', { choice: 'REFOCUS', baseVersion: 5 }, expect.any(String)));
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

  it('a reached limit keeps the edit and disables save with the wait', async () => {
    vi.mocked(api.getLimits).mockResolvedValue({ limits: [{ action: 'AI_ACTION', limit: 50, remaining: 0, resetsAt: new Date(Date.now() + 700_000).toISOString() }] } as never);
    await render(<PreviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quick edit A1' }));
    fireEvent.change(screen.getByLabelText('Quick edit A1', { selector: 'textarea' }), { target: { value: 'Kept' } });
    expect(await screen.findByText(/Rechecks are paused for 12 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wait 12 min' })).toBeDisabled();
    expect(screen.getByLabelText('Quick edit A1', { selector: 'textarea' })).toHaveValue('Kept');
    expect(screen.getByText(/Approval uses the last saved version/)).toBeInTheDocument();
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

  it('a warning needs a reason, and approve waits for it', async () => {
    vi.mocked(api.getApproval).mockResolvedValue({ tasks: [approvalTask('Q1', { decisionsNeeded: [finding] }), approvalTask('Q2'), approvalTask('Q3'), approvalTask('Q4'), approvalTask('Q5')], contentManifestHash: 'h', canApprove: false });
    await render(<ApprovePage />);
    expect(await screen.findByRole('button', { name: 'Approve Q1' })).toBeDisabled();
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
    perTask: [{ slot: 'Q1', submitted: 8, keep: 4, revise: 4, avgConfidenceBefore: 68, avgConfidenceAfter: 76, deliveredChallenges: [{ label: 'TN1', count: 3 }] }],
    q1Relations: { releaseLabel: 'r4', denominator: 8, before: { full: 2, partial: 2, contradicts: 3, irrelevant: 1 }, after: { full: 5, partial: 1, contradicts: 2, irrelevant: 0 } },
  } as unknown as ClassTrackingDTO;

  it('shows codes, N started and M finished, and links to the trace', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    await render(<TrackingPage />);
    expect(await screen.findByText('8 people started, 8 finished')).toBeInTheDocument();
    expect(screen.getByText('P-7K2M')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View trace' })[0]).toHaveAttribute('href', '/t/attempts/$id/trace/$slot');
  });

  it('shows keep and revise, confidence, prompts and the disclaimer', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    await render(<TrackingPage />);
    expect(await screen.findByText('4 / 4')).toBeInTheDocument();
    expect(screen.getByText('68 → 76')).toBeInTheDocument();
    expect(screen.getByText('TN1 · 3')).toBeInTheDocument();
    expect(screen.getByText('Full 5/8')).toBeInTheDocument();
    expect(screen.getByText(/not enough to conclude that students learned better/)).toBeInTheDocument();
  });

  it('someone who declined shows Not in research', async () => {
    vi.mocked(api.getTracking).mockResolvedValue(tracking);
    await render(<TrackingPage />);
    expect(await screen.findByText('Not in research')).toBeInTheDocument();
  });

  it('the trace shows labels, the prompt, why it was chosen, changes and the disclaimer', async () => {
    vi.mocked(api.getTrace).mockResolvedValue({
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
