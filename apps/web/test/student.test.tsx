import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Artifact, type MeDTO, type StudentTaskDTO } from '@logina/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskRunner } from '@/features/student/TaskRunner';
import { Q2Editor, Q3Editor, Q4Editor, Q5Editor, emptyDraft, isComplete } from '@/features/student/editors';
import { ResultSet } from '@/features/student/ResultSet';
import * as api from '@/lib/api';
import { renderWithI18n } from './utils';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'att1', slot: 'Q1' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<object>()),
  getStudentTask: vi.fn(),
  getMyAssignments: vi.fn(async () => ({ assignments: [{ attemptId: 'att1', lessonTitle: 'Lesson 8', assignmentId: 'a', teacherName: 'x', status: 'IN_PROGRESS' }] })),
  saveDraft: vi.fn(async () => ({ ok: true })),
  lockTask: vi.fn(),
  getChallenge: vi.fn(),
  submitTask: vi.fn(),
  getFeedback: vi.fn(),
  getMe: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const q1 = (over: Partial<StudentTaskDTO> = {}) =>
  ({
    slot: 'Q1',
    phase: 'REASON',
    stem: 'Which statement?',
    draftArtifact: null,
    answers: [{ id: 'a1', text: 'First statement' }, { id: 'a2', text: 'Second statement' }],
    evidence: [{ id: 'e1', text: 'Card one' }, { id: 'e2', text: 'Card two' }],
    ...over,
  }) as StudentTaskDTO;

const locked = { deliveryId: 'd', message: 'Look at the figures again.', lockedSummary: { answerText: 'First statement', evidenceText: 'Card one', confidence: 70 } };
const lockedTask = () => q1({ phase: 'CHALLENGED', initialArtifact: { slot: 'Q1', answerId: 'a1', evidenceId: 'e1' }, initialConfidence: 70 });
const me = { uid: 'u', role: 'demo', displayName: 'x', schoolId: 's', classIds: [], uiLocale: 'en', demoMenu: true, consentRequired: false, currentConsentVersion: 'v' } as unknown as MeDTO;

const render = (ui: React.ReactElement) =>
  renderWithI18n(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const choose = (name: string) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getMe).mockResolvedValue(me);
  vi.mocked(api.getChallenge).mockResolvedValue(locked);
});

describe('Q1 flow', () => {
  it('Continue is enabled only with one answer and one card', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    await render(<TaskRunner />);
    const next = await screen.findByRole('button', { name: 'Continue →' });
    expect(next).toBeDisabled();
    choose('First statement');
    expect(next).toBeDisabled();
    choose('Card one');
    expect(next).toBeEnabled();
  });

  it('a disabled Continue says what is still missing', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    await render(<TaskRunner />);
    expect(await screen.findByText('Choose a statement to continue.')).toBeInTheDocument();
    choose('First statement');
    expect(screen.getByText('Choose an evidence card to continue.')).toBeInTheDocument();
    choose('Card one');
    expect(screen.queryByText(/to continue\.$/)).toBeNull();
  });

  it('the top bar names the lesson, not the list of lessons', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    await render(<TaskRunner />);
    expect(await screen.findByText('Lesson 8')).toBeInTheDocument();
  });

  it('the steps sit under the current task and follow the student', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1', evidenceId: 'e1' } }));
    const { container } = await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue →' }));
    const steps = container.querySelector('.tasks > li.on .phase')!;
    expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent('Lock in');
    expect(container.querySelectorAll('.phase')).toHaveLength(1);
  });

  it('progress marks only tasks really submitted as done', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ submittedSlots: ['Q3'] }));
    const { container } = await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    expect([...container.querySelectorAll('.tasks > li')].map((step) => step.className)).toEqual(['on', '', 'done', '', '']);
  });

  it('the student sees when a draft is saved and when it is not', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    choose('First statement');
    expect(await screen.findByText('Saved', {}, { timeout: 2000 })).toBeInTheDocument();
    vi.mocked(api.saveDraft).mockRejectedValueOnce(new api.ApiError(409, 'ALREADY_LOCKED'));
    choose('Second statement');
    expect(await screen.findByText(/^Not saved yet/, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('a refused draft is not sent again', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    vi.mocked(api.saveDraft).mockRejectedValue(new api.ApiError(409, 'ALREADY_LOCKED'));
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    choose('First statement');
    await screen.findByText(/^Not saved yet/, {}, { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.saveDraft).toHaveBeenCalledTimes(1);
    vi.mocked(api.saveDraft).mockResolvedValue({ ok: true });
  });

  it('opening a page does not save it again', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1' } }));
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(api.saveDraft).not.toHaveBeenCalled();
  });

  it('a draft autosaves after a change', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    choose('First statement');
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledWith('att1', 'Q1', { draftArtifact: { slot: 'Q1', answerId: 'a1' } }), { timeout: 2000 });
  });

  it('Lock starts ready at 50 and sends one request on double click', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1', evidenceId: 'e1' } }));
    vi.mocked(api.lockTask).mockImplementation(() => new Promise(() => {}));
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue →' }));
    const lock = screen.getByRole('button', { name: 'Lock in answer' });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    fireEvent.click(lock);
    fireEvent.click(lock);
    await waitFor(() => expect(api.lockTask).toHaveBeenCalled());
    expect(api.lockTask).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.lockTask).mock.calls[0]![2]).toMatchObject({ initialConfidence: 50 });
  });

  it('F-S9 a reload after lock shows the same answer and prompt with no second lock', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    expect(await screen.findByText('Look at the figures again.')).toBeInTheDocument();
    expect(screen.getByText('First statement')).toBeInTheDocument();
    expect(api.lockTask).not.toHaveBeenCalled();
  });

  it('Keep and Revise have identical classes', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    const keep = await screen.findByRole('button', { name: 'Keep my answer' });
    expect(keep.className).toBe(screen.getByRole('button', { name: 'Revise answer' }).className);
  });

  it('F-S5 Keep shows the locked answer and submits it', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'KEEP', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep my answer' }));
    expect(screen.getByText("You're keeping your answer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/s/attempts/$id/$slot', params: { id: 'att1', slot: 'Q2' } }));
    expect(vi.mocked(api.submitTask).mock.calls[0]?.[2]).toMatchObject({ choice: 'KEEP', finalArtifact: { answerId: 'a1', evidenceId: 'e1' }, finalConfidence: 50 });
  });

  it('S4 marks new choices New and originals original', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revise answer' }));
    choose('Second statement');
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getAllByText('original').length).toBeGreaterThan(0);
  });

  it('S6 an unchanged revise says Keep, with one knob starting at 50', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revise answer' }));
    expect(screen.getByText(/so it will be recorded as/)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    expect(document.querySelectorAll('.knob')).toHaveLength(1);
  });

  it('the last task goes to results', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'KEEP', attemptStatus: 'COMPLETE' });
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep my answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/s/attempts/$id/results', params: { id: 'att1' } }));
  });

  it('after a reset the attempt offers the new set', async () => {
    vi.mocked(api.getStudentTask).mockRejectedValue(new api.ApiError(404, 'NOT_FOUND'));
    await render(<TaskRunner />);
    expect(await screen.findByText('Open the new set')).toBeInTheDocument();
  });
});

describe('Q2 to Q5', () => {
  const noop = () => {};

  it('Q2 ranking reorders with buttons, not drag only', async () => {
    const onChange = vi.fn();
    const body = { cards: [{ cardId: 'k1', text: 'One' }, { cardId: 'k2', text: 'Two' }], basis: 'b' };
    await render(<Q2Editor body={body} value={{ slot: 'Q2', orderedCardIds: ['k1', 'k2'] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Two up' }));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q2', orderedCardIds: ['k2', 'k1'] });
  });

  it('Q3 requires every criterion and a decision', () => {
    const task = { slot: 'Q3', taskBody: { options: [], criteria: [{ criterionId: 'c1', text: 'x' }, { criterionId: 'c2', text: 'y' }], constraints: [] } } as unknown as StudentTaskDTO;
    expect(isComplete(task, { slot: 'Q3', comparisons: [{ criterionId: 'c1', value: 'o' }], judgmentOptionId: 'o', tradeOffIds: [] })).toBe(false);
    expect(isComplete(task, { slot: 'Q3', comparisons: [{ criterionId: 'c1', value: 'o' }, { criterionId: 'c2', value: 'o' }], tradeOffIds: [] })).toBe(false);
    expect(isComplete(task, { slot: 'Q3', comparisons: [{ criterionId: 'c1', value: 'o' }, { criterionId: 'c2', value: 'o' }], judgmentOptionId: 'o', tradeOffIds: [] })).toBe(true);
  });

  it('a Q3 answer with no drawback ticked is still a valid artifact', () => {
    const task = { slot: 'Q3', draftArtifact: null, taskBody: { options: [], criteria: [], constraints: [] } } as unknown as StudentTaskDTO;
    const draft = { ...emptyDraft(task), comparisons: [{ criterionId: 'c1', value: 'o' }], judgmentOptionId: 'o' };
    expect(Artifact.safeParse(draft).success).toBe(true);
  });

  it('Q3 shows options, criteria and trade-offs', async () => {
    const body = { options: [{ optionId: 'o1', text: 'Plan A' }], criteria: [{ criterionId: 'c1', text: 'Cost' }], constraints: [{ tradeOffId: 't1', text: 'Slower' }] };
    await render(<Q3Editor body={body} value={{ slot: 'Q3' }} onChange={noop} />);
    expect(screen.getByRole('group', { name: 'Cost' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Slower' })).toBeInTheDocument();
  });

  it('Q3 asks each criterion once, and a screen reader still hears the full option', async () => {
    const options = [{ optionId: 'o1', text: 'Plan A' }, { optionId: 'o2', text: 'Plan B' }];
    const criteria = [{ criterionId: 'c1', text: 'Cost' }, { criterionId: 'c2', text: 'Speed' }];
    await render(<Q3Editor body={{ options, criteria, constraints: [] }} value={{ slot: 'Q3' }} onChange={noop} />);
    const cost = screen.getByRole('group', { name: 'Cost' });
    expect(within(cost).getAllByRole('radio')).toHaveLength(2);
    expect(within(cost).getByRole('radio', { name: /Plan B/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Speed' })).toBeInTheDocument();
  });

  it('Think again on Q4 shows the finished sentence, not the blanks', async () => {
    const taskBody = { templates: [{ templateId: 't1', text: 'The source shows [shown], but not [missing].', slots: [{ slotId: 'shown', choices: [{ choiceId: 's1', text: 'a fall' }] }, { slotId: 'missing', choices: [{ choiceId: 'm1', text: 'why' }] }] }] };
    const initialArtifact = { slot: 'Q4', templateId: 't1', slots: [{ slotId: 'shown', choiceId: 's1' }, { slotId: 'missing', choiceId: 'm1' }] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q4', phase: 'CHALLENGED', stem: 'Reply', draftArtifact: null, taskBody, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const sentence = (await screen.findByText('a fall')).closest('p')!;
    expect(sentence).toHaveTextContent('The source shows a fall, but not why.');
    expect(sentence.querySelectorAll('mark')).toHaveLength(2);
  });

  it('Think again on Q5 shows both the proposal and the reason', async () => {
    const initialArtifact = { slot: 'Q5', proposal: 'Open trade courses', reason: 'Many jobs need training' };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q5', phase: 'CHALLENGED', stem: 'Propose', draftArtifact: null, taskBody: { instructions: 'Write', maxCharsPerField: 120 }, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    expect(await screen.findByText('Open trade courses')).toBeInTheDocument();
    expect(screen.getByText('Many jobs need training')).toBeInTheDocument();
    expect(screen.getByText('Your reason')).toBeInTheDocument();
  });

  it('Think again on Q2 lists the cards in the order the student locked', async () => {
    const taskBody = { cards: [{ cardId: 'c1', text: 'Trade' }, { cardId: 'c2', text: 'Machines' }, { cardId: 'c3', text: 'Cities' }] };
    const initialArtifact = { slot: 'Q2', orderedCardIds: ['c3', 'c1', 'c2'] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q2', phase: 'CHALLENGED', stem: 'Rank them', draftArtifact: null, taskBody, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    await screen.findByText('Cities');
    const ranked = screen.getByText('Cities').closest('ol')!;
    expect([...ranked.querySelectorAll('li')].map((row) => row.textContent)).toEqual(['1Cities', '2Trade', '3Machines']);
  });

  it('Think again on Q3 lists every question with the chosen answer', async () => {
    const taskBody = {
      options: [{ optionId: 'o1', text: 'Plan A' }, { optionId: 'o2', text: 'Plan B' }],
      criteria: [{ criterionId: 'c1', text: 'Which costs less?' }, { criterionId: 'c2', text: 'Which is faster?' }],
      constraints: [{ tradeOffId: 't1', text: 'Slower' }, { tradeOffId: 't2', text: 'Dearer' }],
    };
    const initialArtifact = { slot: 'Q3', comparisons: [{ criterionId: 'c1', value: 'o1' }, { criterionId: 'c2', value: 'o2' }], judgmentOptionId: 'o2', tradeOffIds: ['t2'] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q3', phase: 'CHALLENGED', stem: 'Which plan?', draftArtifact: null, taskBody, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const answered = (question: string) => screen.getByText(question).parentElement!;
    expect(await screen.findByText('Which costs less?')).toBeInTheDocument();
    expect(answered('Which costs less?')).toHaveTextContent('Plan A');
    expect(answered('Which is faster?')).toHaveTextContent('Plan B');
    expect(answered('Your decision')).toHaveTextContent('Plan B');
    expect(answered('What drawbacks do you accept?')).toHaveTextContent('Dearer');
    expect(screen.queryByText('Slower')).toBeNull();
  });

  it('Q4 shows only the slots of the chosen template', async () => {
    const body = { templates: [
      { templateId: 't1', text: 'First', slots: [{ slotId: 's1', choices: [{ choiceId: 'c1', text: 'Alpha' }] }] },
      { templateId: 't2', text: 'Second', slots: [{ slotId: 's2', choices: [{ choiceId: 'c2', text: 'Beta' }] }] },
    ] };
    await render(<Q4Editor body={body} value={{ slot: 'Q4', templateId: 't2' }} onChange={noop} />);
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Alpha' })).toBeNull();
  });

  it('Q5 counts characters and stops at 120', async () => {
    const body = { instructions: 'Write.', maxCharsPerField: 120 as const };
    await render(<Q5Editor body={body} value={{ slot: 'Q5', proposal: 'abc' }} onChange={noop} />);
    expect(screen.getByText('3/120')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('maxLength', '120');
  });
});

describe('results', () => {
  const row = (slot: string, changed: boolean) => ({
    slot,
    choice: changed ? 'REVISE' : 'KEEP',
    initial: { label: 'B', text: 'x' },
    challengeMessage: 'm',
    final: { label: changed ? 'A' : 'B', text: 'y' },
    confidenceBefore: 70,
    confidenceAfter: 82,
    explanations: [],
  });

  it('S8 shows Keep and Revise in the same neutral style with no score and no participant code', async () => {
    vi.mocked(api.getFeedback).mockResolvedValue([row('Q1', true), row('Q2', false)] as never);
    await render(<ResultSet />);
    const keep = await screen.findByText('Keep');
    expect(keep.className).toBe(screen.getByText('Revise').className);
    expect(screen.queryByText('P-7K2M')).toBeNull();
    expect(screen.getByText(/does not grade you/)).toBeInTheDocument();
  });

  it('S8 shows no code line after declining', async () => {
    vi.mocked(api.getFeedback).mockResolvedValue([row('Q1', false)] as never);
    await render(<ResultSet />);
    await screen.findByText('Keep');
    expect(screen.queryByText('PARTICIPANT CODE')).toBeNull();
  });

  it('results stay locked until all five are done', async () => {
    vi.mocked(api.getFeedback).mockRejectedValue(new api.ApiError(409, 'ATTEMPT_INCOMPLETE'));
    await render(<ResultSet />);
    expect(await screen.findByText('Finish every task first.')).toBeInTheDocument();
  });
});
