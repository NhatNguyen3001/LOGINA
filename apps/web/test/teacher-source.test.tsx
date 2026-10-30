import type { JobDTO, LessonDTO, SourceReviewDTO } from '@logina/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyzePage } from '@/features/lessons/AnalyzePage';
import { clearKeptLesson, CreateLesson } from '@/features/lessons/CreateLesson';
import { ClarifyPage } from '@/features/source/ClarifyPage';
import { SourcePage } from '@/features/source/SourcePage';
import * as api from '@/lib/api';
import { renderWithI18n } from './utils';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'l1' }),
  Navigate: ({ to }: { to: string }) => <p>{`redirect ${to}`}</p>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<object>()),
  getMe: vi.fn(),
  getClass: vi.fn(),
  getLimits: vi.fn(async () => ({ limits: [] })),
  createLesson: vi.fn(),
  registerMaterial: vi.fn(),
  getUploadUrl: vi.fn(),
  startAnalyze: vi.fn(),
  getLesson: vi.fn(),
  getJob: vi.fn(),
  cancelJob: vi.fn(),
  getSourceReview: vi.fn(),
  resolveIssue: vi.fn(async () => ({ ok: true })),
  approveSource: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const render = (ui: React.ReactElement, lang: 'en' | 'vi' = 'en') =>
  renderWithI18n(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>, { lang });

const issue = (id: string, over: Partial<SourceReviewDTO['issues'][number]> = {}) =>
  ({ id, pointNumber: Number(id.slice(3)), issueType: 'MISSING', severity: 'BLOCKER', bubble: `Bubble ${id}`, currentInterpretation: 'Shares only', suggestions: [{ id: 'sug1', text: 'A suggestion', sourceRef: 'p. 8' }], state: 'UNRESOLVED', spans: [{ paragraphId: 'p1', start: 0, end: 5 }], ...over }) as SourceReviewDTO['issues'][number];

const review = (over: Partial<SourceReviewDTO> = {}) =>
  ({
    sourceModelDraftId: 'd',
    version: 4,
    approvedSourceVersion: null,
    readByAI: false,
    summaryClaims: [{ id: 'c1', wording: 'The share fell.', evidenceSnippet: 'it fell', locator: 'p. 8', status: 'VERIFIED' }],
    teacherDecisions: [],
    openGaps: [],
    excluded: [],
    material: { materialVersionId: 'm', fileName: 'a.pdf', mimeType: 'application/pdf', unitKind: 'PAGE', title: 'A', locator: '', paragraphs: [{ id: 'p1', page: 8, text: 'Paragraph text', readBy: 'SEEDED' }] },
    issues: [issue('iss1')],
    approveReady: false,
    blockersRemaining: 1,
    ...over,
  }) as SourceReviewDTO;

const fillForm = () => {
  for (const [label, value] of [[/Source title/, 'Book'], [/Reasoning goal/, 'Goal'], [/Lesson set title/, 'Title'], [/Subject/, 'Geo'], [/Topic/, 'Labor']] as const) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  clearKeptLesson();
  vi.mocked(api.getMe).mockResolvedValue({ classIds: ['c1'] } as never);
  vi.mocked(api.getClass).mockResolvedValue({ id: 'c1', name: '12A3' });
  vi.mocked(api.createLesson).mockResolvedValue({ id: 'l1' } as LessonDTO);
  vi.mocked(api.registerMaterial).mockResolvedValue({ materialVersionId: 'm', aiMode: 'SEEDED' });
  vi.mocked(api.startAnalyze).mockResolvedValue({ id: 'j' } as JobDTO);
  vi.mocked(api.getSourceReview).mockResolvedValue(review());
});

describe('T1', () => {
  it('a missing title shows an error under the field', async () => {
    await render(<CreateLesson sampleAllowed />);
    await screen.findByText('12A3');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze material' }));
    expect((await screen.findAllByText('This field is required.')).length).toBeGreaterThan(0);
    expect(api.createLesson).not.toHaveBeenCalled();
  });

  it('shows the fixed Q1 to Q5 structure read-only, and the class name', async () => {
    await render(<CreateLesson />);
    expect(await screen.findByText('12A3')).toBeInTheDocument();
    expect(screen.getByText('Q4 · Counterargument template')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add|remove/i })).toBeNull();
  });

  it('the language defaults to the interface language and is sent as contentLocale', async () => {
    await render(<CreateLesson sampleAllowed />, 'vi');
    await screen.findByText('12A3');
    expect(screen.getByLabelText(/Ngôn ngữ học liệu/)).toHaveValue('vi');
  });

  it('Use sample material appears only in demo mode', async () => {
    await render(<CreateLesson sampleAllowed={false} />);
    expect(screen.queryByRole('button', { name: 'Use sample material' })).toBeNull();
  });

  it('Use sample material sends sample true, skips the upload and goes to analyze', async () => {
    await render(<CreateLesson sampleAllowed />);
    await screen.findByText('12A3');
    fireEvent.click(screen.getByRole('button', { name: 'Use sample material' }));
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze material' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/lessons/$id/analyze', params: { id: 'l1' } }));
    expect(api.registerMaterial).toHaveBeenCalledWith('l1', { sample: true }, expect.any(String));
    expect(api.getUploadUrl).not.toHaveBeenCalled();
  });

  it('a refusal keeps the inputs, explains why, and does not create a second lesson', async () => {
    vi.mocked(api.registerMaterial).mockRejectedValueOnce(new api.ApiError(422, 'TOO_MANY_PAGES'));
    await render(<CreateLesson sampleAllowed />);
    await screen.findByText('12A3');
    fireEvent.click(screen.getByRole('button', { name: 'Use sample material' }));
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze material' }));
    expect(await screen.findByText(/longer than 10 pages/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Source title/)).toHaveValue('Book');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze material' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(api.createLesson).toHaveBeenCalledTimes(1);
  });
});

describe('T2', () => {
  const job = (over: Partial<JobDTO>): JobDTO => ({ id: 'j', type: 'PARSE', status: 'RUNNING', steps: [{ label: 'One', status: 'DONE' }, { label: 'Two', status: 'DONE' }, { label: 'Three', status: 'RUNNING' }], ...over }) as JobDTO;

  beforeEach(() => {
    vi.mocked(api.getLesson).mockResolvedValue({ id: 'l1', stage: 'CLARIFY', activeJobId: 'j' } as LessonDTO);
  });

  it('resumes from the current job step', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({}));
    await render(<AnalyzePage />);
    expect(await screen.findByText('2/3 steps')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Running' })).toBeInTheDocument();
  });

  it('Stop analysis cancels and returns to T1', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({}));
    vi.mocked(api.cancelJob).mockResolvedValue(job({ status: 'CANCELLED' }));
    await render(<AnalyzePage />);
    await screen.findByText('2/3 steps');
    fireEvent.click(screen.getByRole('button', { name: 'Stop analysis' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/lessons/new' }));
  });

  it('a finished job with issues goes to clarify', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({ status: 'DONE' }));
    await render(<AnalyzePage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/lessons/$id/clarify', params: { id: 'l1' } }));
  });

  it('a finished job without issues goes to source', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({ status: 'DONE' }));
    vi.mocked(api.getSourceReview).mockResolvedValue(review({ issues: [] }));
    await render(<AnalyzePage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/lessons/$id/source', params: { id: 'l1' } }));
  });

  it('a failed job shows the reason and Try again', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({ status: 'FAILED', errorCode: 'UNREADABLE' } as Partial<JobDTO>));
    await render(<AnalyzePage />);
    expect(await screen.findByText("We couldn't read any text in this file.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('a language question pauses and offers both choices', async () => {
    vi.mocked(api.getJob).mockResolvedValue(job({ status: 'NEEDS_INPUT', question: { kind: 'LANGUAGE_MISMATCH', detected: 'vi', chosen: 'en' } }));
    await render(<AnalyzePage />);
    expect(await screen.findByRole('button', { name: 'Use Vietnamese' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep English' })).toBeInTheDocument();
  });
});

describe('T3 and T4', () => {
  it('Confirm sends CONFIRM with the review version', async () => {
    await render(<ClarifyPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm current reading' }));
    await waitFor(() => expect(api.resolveIssue).toHaveBeenCalledWith('l1', 'iss1', { action: 'CONFIRM', baseVersion: 4 }, expect.any(String)));
  });

  it('Use suggestion sends USE_SUGGESTION', async () => {
    await render(<ClarifyPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Use selected suggestion' }));
    await waitFor(() => expect(api.resolveIssue).toHaveBeenCalledWith('l1', 'iss1', { action: 'USE_SUGGESTION', suggestionId: 'sug1', baseVersion: 4 }, expect.any(String)));
  });

  it('Exclude asks for a reason before sending', async () => {
    await render(<ClarifyPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Exclude' }));
    const confirm = screen.getByRole('button', { name: 'Exclude this point' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why exclude this?'), { target: { value: 'Out of scope' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.resolveIssue).toHaveBeenCalledWith('l1', 'iss1', { action: 'EXCLUDE', excludeReason: 'Out of scope', baseVersion: 4 }, expect.any(String)));
  });

  it('keep open requires bounds and a reason', async () => {
    await render(<ClarifyPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep open (bounded)' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('What the lesson may say'), { target: { value: 'Shares' } });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why it stays open'), { target: { value: 'No totals' } });
    expect(save).toBeEnabled();
  });

  it('adjust shows the change before saving, as the teacher reading', async () => {
    await render(<ClarifyPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adjust myself' }));
    fireEvent.change(screen.getByLabelText('Your wording'), { target: { value: 'New wording' } });
    expect(screen.getByText('New wording', { selector: 'ins' })).toBeInTheDocument();
    expect(screen.getByText("Saved as: teacher's reading")).toBeInTheDocument();
  });

  it('every blocker renders even with more than three', async () => {
    vi.mocked(api.getSourceReview).mockResolvedValue(review({ issues: ['iss1', 'iss2', 'iss3', 'iss4', 'iss5'].map((id) => issue(id)), blockersRemaining: 5 }));
    await render(<ClarifyPage />);
    expect(await screen.findAllByText(/^Bubble iss/)).toHaveLength(5);
  });

  it('hovering a card highlights its source paragraph', async () => {
    await render(<ClarifyPage />);
    fireEvent.mouseEnter((await screen.findByText('Bubble iss1')).closest('article')!);
    expect(screen.getByTestId('paragraph-p1')).toHaveClass('lit');
  });

  it('a resolved card shows who and can be reopened', async () => {
    vi.mocked(api.getSourceReview).mockResolvedValue(review({ issues: [issue('iss1', { state: 'CONFIRMED', resolvedBy: 'Ms. Lan', resolvedAt: '2026-10-31T00:00:00.000Z' })], blockersRemaining: 0 }));
    await render(<ClarifyPage />);
    expect(await screen.findByText(/Saved by Ms. Lan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(api.resolveIssue).toHaveBeenCalledWith('l1', 'iss1', { action: 'REOPEN', baseVersion: 4 }, expect.any(String)));
  });

  it('continue is disabled with blockers and says why', async () => {
    await render(<ClarifyPage />);
    expect(await screen.findByRole('button', { name: 'Continue: Source review →' })).toBeDisabled();
    expect(screen.getByText('Resolve or exclude every blocker to continue.')).toBeInTheDocument();
  });
});

describe('T5', () => {
  it('approve is blocked until ready', async () => {
    await render(<SourcePage />);
    expect(await screen.findByRole('button', { name: 'Approve source (Approval 1)' })).toBeDisabled();
  });

  it('approval sends the version and moves to tasks', async () => {
    vi.mocked(api.getSourceReview).mockResolvedValue(review({ approveReady: true, blockersRemaining: 0 }));
    vi.mocked(api.approveSource).mockResolvedValue({ sourceModelVersionId: 's', version: 1, jobId: 'j' });
    await render(<SourcePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve source (Approval 1)' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/t/lessons/$id/tasks', params: { id: 'l1' } }));
    expect(api.approveSource).toHaveBeenCalledWith('l1', 4, expect.any(String));
  });

  it('material read by AI shows the notice and the original link', async () => {
    vi.mocked(api.getSourceReview).mockResolvedValue(review({ readByAI: true }));
    await render(<SourcePage />);
    expect(await screen.findByText(/LOGINA read this file with AI/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open original page' })).toBeInTheDocument();
  });
});
