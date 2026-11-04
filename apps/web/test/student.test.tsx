import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MeDTO, StudentTaskDTO } from '@logina/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskRunner } from '@/features/student/TaskRunner';
import { Q2Editor, Q3Editor, Q4Editor, Q5Editor, describeChange, isComplete, missingKey } from '@/features/student/editors';
import { createTrace } from '@/features/student/use-task-trace';
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
    submittedSlots: [],
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

const lockedAnswer = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'See your locked answer' }));
  return within(document.querySelector<HTMLElement>('.ans')!);
};

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
    await waitFor(() => expect(next).toBeEnabled(), { timeout: 2000 });
  });

  it('Continue waits until the answer is saved', async () => {
    let finish: (value: { ok: true }) => void = () => {};
    vi.mocked(api.saveDraft).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1' } }));
    await render(<TaskRunner />);
    const next = await screen.findByRole('button', { name: 'Continue →' });
    choose('Card one');
    expect(next).toBeDisabled();
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled(), { timeout: 2000 });
    expect(next).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(next).toBeEnabled());
    expect(screen.getByText('Saved')).toBeInTheDocument();
    vi.mocked(api.saveDraft).mockImplementation(async () => ({ ok: true }));
  });

  it('a failed save keeps Continue off and offers Try again', async () => {
    vi.mocked(api.saveDraft).mockRejectedValueOnce(new api.ApiError(409, 'ALREADY_LOCKED'));
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1' } }));
    await render(<TaskRunner />);
    const next = await screen.findByRole('button', { name: 'Continue →' });
    choose('Card one');
    expect(await screen.findByText("Couldn't save your answer.", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(next).toBeEnabled());
    expect(api.saveDraft).toHaveBeenCalledTimes(2);
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
    expect(await screen.findByText("Couldn't save your answer.", {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('a refused draft is not sent again', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    vi.mocked(api.saveDraft).mockRejectedValue(new api.ApiError(409, 'ALREADY_LOCKED'));
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Continue →' });
    choose('First statement');
    await screen.findByText("Couldn't save your answer.", {}, { timeout: 2000 });
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

  it('the prompt sits on the task, with the first answer and first confidence in place', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    expect(await screen.findByText('Your answer is unchanged. This will be recorded as Keep.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /First statement/ })).toBeChecked();
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '70');
    expect(document.querySelectorAll('[data-slot="slider-thumb"]')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Keep my answer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to your first answer' })).toBeDisabled();
  });

  it('F-S5 an unchanged answer submits as Keep, with no first change', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'KEEP', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/s/attempts/$id/$slot', params: { id: 'att1', slot: 'Q2' } }));
    const sent = vi.mocked(api.submitTask).mock.calls[0]?.[2];
    expect(sent).toMatchObject({ choice: 'KEEP', finalArtifact: { answerId: 'a1', evidenceId: 'e1' }, finalConfidence: 70 });
    expect(sent).not.toHaveProperty('secondsToFirstChange');
  });

  it('S4 a changed answer submits as Revise and marks the first answer', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'REVISE', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Submit Q1' });
    choose('Second statement');
    expect(screen.getByText('You changed your answer. This will be recorded as Revise.')).toBeInTheDocument();
    expect(screen.getByText('Your first answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(api.submitTask).toHaveBeenCalled());
    expect(vi.mocked(api.submitTask).mock.calls[0]?.[2]).toMatchObject({ choice: 'REVISE', secondsToFirstChange: expect.any(Number) });
  });

  it('going back to the first answer says Keep again, and still reports the first change', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'KEEP', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Submit Q1' });
    choose('Second statement');
    fireEvent.click(screen.getByRole('button', { name: 'Back to your first answer' }));
    expect(screen.getByText('Your answer is unchanged. This will be recorded as Keep.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(api.submitTask).toHaveBeenCalled());
    expect(vi.mocked(api.submitTask).mock.calls[0]?.[2]).toMatchObject({ choice: 'KEEP', secondsToFirstChange: expect.any(Number) });
  });

  it('the last task goes to results', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'KEEP', attemptStatus: 'COMPLETE' });
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit Q1' }));
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

  const q3Body = {
    options: [{ optionId: 'o1', text: 'Plan A' }, { optionId: 'o2', text: 'Plan B' }],
    tradeOffs: [
      { tradeOffId: 't1', optionId: 'o1', text: 'Slower', reasons: [{ reasonId: 'r1', text: 'It needs more steps' }, { reasonId: 'r2', text: 'It is cursed' }] },
      { tradeOffId: 't2', optionId: 'o2', text: 'Dearer', reasons: [{ reasonId: 'r3', text: 'It uses more staff' }] },
    ],
  };

  it('Q3 needs a path, a cost and a reason', () => {
    const task = { slot: 'Q3', taskBody: q3Body } as unknown as StudentTaskDTO;
    expect(isComplete(task, { slot: 'Q3', judgmentOptionId: 'o1' })).toBe(false);
    expect(isComplete(task, { slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't1' })).toBe(false);
    expect(isComplete(task, { slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't1', reasonId: 'r1' })).toBe(true);
    expect(missingKey(task, { slot: 'Q3', judgmentOptionId: 'o1' })).toBe('student.need.tradeOff');
  });

  it('Q3 shows only the costs of the chosen path and the reasons of the chosen cost', async () => {
    await render(<Q3Editor body={q3Body} value={{ slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't1' }} onChange={noop} />);
    expect(screen.getByRole('radio', { name: 'Slower' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Dearer' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'It needs more steps' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'It uses more staff' })).toBeNull();
  });

  it('Q3 asks for a path before showing costs', async () => {
    await render(<Q3Editor body={q3Body} value={{ slot: 'Q3' }} onChange={noop} />);
    expect(screen.getByText('Choose a path first.')).toBeInTheDocument();
    expect(screen.getByText('Choose what it gives up first.')).toBeInTheDocument();
  });

  it('changing the Q3 path clears the cost and the reason', async () => {
    const onChange = vi.fn();
    await render(<Q3Editor body={q3Body} value={{ slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't1', reasonId: 'r1' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Plan B/ }));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q3', judgmentOptionId: 'o2' });
  });

  it('changing the Q3 cost clears the reason', async () => {
    const onChange = vi.fn();
    const body = { ...q3Body, tradeOffs: [...q3Body.tradeOffs, { tradeOffId: 't3', optionId: 'o1', text: 'Riskier', reasons: [] }] };
    await render(<Q3Editor body={body} value={{ slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't1', reasonId: 'r1' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Riskier' }));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q3', judgmentOptionId: 'o1', tradeOffId: 't3' });
  });

  it('Think again on Q4 shows the finished sentence, not the blanks', async () => {
    const taskBody = { frame: 'The source shows [shown], but not [missing].', slots: [{ slotId: 'shown', label: 'Shows' }, { slotId: 'missing', label: 'Gap' }], cards: [{ cardId: 'c1', text: 'a fall' }, { cardId: 'c2', text: 'why' }, { cardId: 'c3', text: 'a rise' }] };
    const initialArtifact = { slot: 'Q4', placements: [{ slotId: 'shown', cardId: 'c1' }, { slotId: 'missing', cardId: 'c2' }] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q4', phase: 'CHALLENGED', stem: 'Reply', draftArtifact: null, taskBody, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const sentence = (await lockedAnswer()).getByText('a fall').closest('p')!;
    expect(sentence).toHaveTextContent('The source shows a fall, but not why.');
    expect(sentence.querySelectorAll('mark')).toHaveLength(2);
  });

  const q5Body = { instructions: 'Write.', maxCharsPerField: 120 as const, starters: [{ starterId: 's1', text: 'Jobs depend on...' }, { starterId: 's2', text: 'Staying gives up...' }] };

  it('Think again on Q5 lists each sentence with its answer', async () => {
    const initialArtifact = { slot: 'Q5', answers: [{ starterId: 's1', text: 'skills' }, { starterId: 's2', text: "I don't know how to answer", declared: 'DONT_KNOW' }] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q5', phase: 'CHALLENGED', stem: 'Finish', draftArtifact: null, taskBody: q5Body, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const locked = await lockedAnswer();
    expect(locked.getByText('Jobs depend on...')).toBeInTheDocument();
    expect(locked.getByText('skills')).toBeInTheDocument();
    expect(locked.getByText("I don't know how to answer")).toBeInTheDocument();
  });

  it('Think again on Q2 lists the cards in the order the student locked', async () => {
    const taskBody = { cards: [{ cardId: 'c1', text: 'Trade' }, { cardId: 'c2', text: 'Machines' }, { cardId: 'c3', text: 'Cities' }] };
    const initialArtifact = { slot: 'Q2', orderedCardIds: ['c3', 'c1', 'c2'] };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q2', phase: 'CHALLENGED', stem: 'Rank them', draftArtifact: null, taskBody, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const ranked = (await lockedAnswer()).getByText('Cities').closest('ol')!;
    expect([...ranked.querySelectorAll('li')].map((row) => row.textContent)).toEqual(['1Cities', '2Trade', '3Machines']);
  });

  it('Think again on Q3 lists the path, the cost and the reason', async () => {
    const initialArtifact = { slot: 'Q3', judgmentOptionId: 'o2', tradeOffId: 't2', reasonId: 'r3' };
    vi.mocked(api.getStudentTask).mockResolvedValue({ slot: 'Q3', phase: 'CHALLENGED', stem: 'Which plan?', draftArtifact: null, taskBody: q3Body, initialArtifact, initialConfidence: 70 } as unknown as StudentTaskDTO);
    await render(<TaskRunner />);
    const locked = await lockedAnswer();
    expect(locked.getByText('Plan B')).toBeInTheDocument();
    expect(locked.getByText('Dearer')).toBeInTheDocument();
    expect(locked.getByText('It uses more staff')).toBeInTheDocument();
  });

  const q4Body = {
    frame: 'It shows [a] but not [b].',
    slots: [{ slotId: 'a', label: 'Shows' }, { slotId: 'b', label: 'Gap' }],
    cards: [{ cardId: 'c1', text: 'Alpha' }, { cardId: 'c2', text: 'Beta' }, { cardId: 'c3', text: 'Gamma' }],
  };
  const blank = (text: string) => screen.getByRole('button', { name: text, description: /./ });

  it('Q4 places a held card in a blank', async () => {
    const onChange = vi.fn();
    await render(<Q4Editor body={q4Body} value={{ slot: 'Q4', placements: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Tap to place the card here' })[1]!);
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q4', placements: [{ slotId: 'b', cardId: 'c2' }] });
  });

  it('Q4 keeps placements in the order of the blanks', async () => {
    const onChange = vi.fn();
    await render(<Q4Editor body={q4Body} value={{ slot: 'Q4', placements: [{ slotId: 'b', cardId: 'c2' }] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap to place the card here' }));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }, { slotId: 'b', cardId: 'c2' }] });
  });

  it('Q4 takes a used card out of the set, and a filled blank swaps its card', async () => {
    const onChange = vi.fn();
    await render(<Q4Editor body={q4Body} value={{ slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }] }} onChange={onChange} />);
    expect(document.querySelectorAll('.word-card')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Gamma' }));
    fireEvent.click(blank('Alpha'));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c3' }] });
  });

  it('Q4 returns a card when its blank is tapped with nothing held', async () => {
    const onChange = vi.fn();
    await render(<Q4Editor body={q4Body} value={{ slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }] }} onChange={onChange} />);
    fireEvent.click(blank('Alpha'));
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q4', placements: [] });
  });

  it('Q4 needs every blank filled', () => {
    const task = { slot: 'Q4', taskBody: q4Body } as unknown as StudentTaskDTO;
    expect(isComplete(task, { slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }] })).toBe(false);
    expect(isComplete(task, { slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }, { slotId: 'b', cardId: 'c2' }] })).toBe(true);
  });

  it('Q5 counts characters and stops at 120', async () => {
    await render(<Q5Editor body={q5Body} value={{ slot: 'Q5', answers: [{ starterId: 's1', text: 'abc' }] }} onChange={noop} />);
    expect(screen.getByText('3/120')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')[0]).toHaveAttribute('maxLength', '120');
  });

  it('Q5 keeps answers in the order of the sentences', async () => {
    const onChange = vi.fn();
    await render(<Q5Editor body={q5Body} value={{ slot: 'Q5', answers: [{ starterId: 's2', text: 'b' }] }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Jobs depend on...'), { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q5', answers: [{ starterId: 's1', text: 'a' }, { starterId: 's2', text: 'b' }] });
  });

  it('a Q5 button replaces typed text and locks the box, and tapping it again clears it', async () => {
    const onChange = vi.fn();
    const label = "I don't know how to answer";
    const { unmount } = await render(<Q5Editor body={q5Body} value={{ slot: 'Q5', answers: [{ starterId: 's1', text: 'abc' }] }} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: label })[0]!);
    expect(onChange).toHaveBeenCalledWith({ slot: 'Q5', answers: [{ starterId: 's1', text: label, declared: 'DONT_KNOW' }] });
    unmount();
    await render(<Q5Editor body={q5Body} value={{ slot: 'Q5', answers: [{ starterId: 's1', text: label, declared: 'DONT_KNOW' }] }} onChange={onChange} />);
    expect(screen.getByLabelText('Jobs depend on...')).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: label })[0]!);
    expect(onChange).toHaveBeenLastCalledWith({ slot: 'Q5', answers: [] });
  });

  it('Q5 needs every sentence finished or marked', () => {
    const task = { slot: 'Q5', taskBody: q5Body } as unknown as StudentTaskDTO;
    expect(isComplete(task, { slot: 'Q5', answers: [{ starterId: 's1', text: 'a' }] })).toBe(false);
    expect(isComplete(task, { slot: 'Q5', answers: [{ starterId: 's1', text: '   ' }, { starterId: 's2', text: 'b' }] })).toBe(false);
    expect(isComplete(task, { slot: 'Q5', answers: [{ starterId: 's1', text: 'a' }, { starterId: 's2', text: 'unsure', declared: 'DONT_KNOW' }] })).toBe(true);
  });
});

describe('smooth steps', () => {
  it('shows the prompt from the lock reply, with no second request', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1({ draftArtifact: { slot: 'Q1', answerId: 'a1', evidenceId: 'e1' } }));
    vi.mocked(api.lockTask).mockResolvedValue({ deliveryId: 'd', message: 'Think about this', lockedSummary: { answerText: 'x', evidenceText: 'y', confidence: 50 } });
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in answer' }));
    expect(await screen.findByText('Think about this')).toBeInTheDocument();
    expect(api.getChallenge).not.toHaveBeenCalled();
  });

  it('fetches the next task before the student submits', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Submit Q1' });
    await waitFor(() => expect(api.getStudentTask).toHaveBeenCalledWith('att1', 'Q2'));
  });

  it('a failed load offers Try again and does not say the set was reset', async () => {
    vi.mocked(api.getStudentTask).mockRejectedValue(new api.ApiError(500, 'INTERNAL'));
    await render(<TaskRunner />);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('This set was reset.')).toBeNull();
  });
});

describe('answer trace', () => {
  beforeEach(() => sessionStorage.clear());

  const opened = () => q1({ draftArtifact: { slot: 'Q1', answerId: 'a1', evidenceId: 'e1' } });

  it('sends every change before locking, and the time on the task', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(q1());
    vi.mocked(api.lockTask).mockResolvedValue({} as never);
    await render(<TaskRunner />);
    await screen.findByRole('radio', { name: /First statement/ });
    choose('First statement');
    choose('Second statement');
    fireEvent.click(screen.getAllByRole('radio')[2]!);
    const next = screen.getByRole('button', { name: 'Continue →' });
    await waitFor(() => expect(next).toBeEnabled(), { timeout: 2000 });
    fireEvent.click(next);
    fireEvent.click(screen.getByRole('button', { name: 'Lock in answer' }));
    await waitFor(() => expect(api.lockTask).toHaveBeenCalled());
    const sent = vi.mocked(api.lockTask).mock.calls[0]![2];
    expect(sent.answerChanges?.map((c) => c.change)).toEqual(['A', 'B', 'Card A']);
    expect(sent.secondsOnTask).toBeGreaterThanOrEqual(0);
  });

  it('keeps the start and earlier changes through a reload', async () => {
    sessionStorage.setItem('logina.trace.att1.Q1', JSON.stringify({ startedAt: Date.now() - 30_000, changes: [{ at: 12, change: 'A' }] }));
    vi.mocked(api.getStudentTask).mockResolvedValue(opened());
    vi.mocked(api.lockTask).mockResolvedValue({} as never);
    await render(<TaskRunner />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lock in answer' }));
    await waitFor(() => expect(api.lockTask).toHaveBeenCalled());
    const sent = vi.mocked(api.lockTask).mock.calls[0]![2];
    expect(sent.answerChanges).toEqual([{ at: 12, change: 'A' }]);
    expect(sent.secondsOnTask).toBeGreaterThanOrEqual(30);
  });

  it('sends changes after the prompt on submit, then clears the trace', async () => {
    vi.mocked(api.getStudentTask).mockResolvedValue(lockedTask());
    vi.mocked(api.submitTask).mockResolvedValue({ slot: 'Q1', recordedChoice: 'REVISE', nextSlot: 'Q2', attemptStatus: 'IN_PROGRESS' });
    await render(<TaskRunner />);
    await screen.findByRole('button', { name: 'Submit Q1' });
    choose('Second statement');
    fireEvent.click(screen.getByRole('button', { name: 'Back to your first answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Q1' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(vi.mocked(api.submitTask).mock.calls[0]![2].answerChanges?.map((c) => c.change)).toEqual(['B', 'A']);
    expect(sessionStorage.getItem('logina.trace.att1.Q1')).toBeNull();
  });

  it('never logs the words a student types', () => {
    const task = { slot: 'Q5', taskBody: { starters: [] } } as unknown as StudentTaskDTO;
    expect(describeChange(task, { slot: 'Q5', answers: [] }, { slot: 'Q5', answers: [{ starterId: 's1', text: 'secret words' }] })).toEqual(['s1']);
    expect(describeChange(task, { slot: 'Q5', answers: [] }, { slot: 'Q5', answers: [{ starterId: 's1', text: 'x', declared: 'DONT_KNOW' }] })).toEqual(['s1=DONT_KNOW']);
  });

  it('logs typing in one sentence as one change', () => {
    const trace = createTrace('a', 'Q5');
    trace.start();
    trace.record('s1');
    trace.record('s1');
    trace.record('s2');
    expect(trace.changes().map((c) => c.change)).toEqual(['s1', 's2']);
  });

  it('names Q3 and Q4 changes for a researcher', () => {
    const q3 = { slot: 'Q3' } as StudentTaskDTO;
    expect(describeChange(q3, { slot: 'Q3', judgmentOptionId: 'O1' }, { slot: 'Q3', judgmentOptionId: 'O1', tradeOffId: 'D1' })).toEqual(['cost=D1']);
    const q4 = { slot: 'Q4' } as StudentTaskDTO;
    expect(describeChange(q4, { slot: 'Q4', placements: [{ slotId: 'a', cardId: 'c1' }] }, { slot: 'Q4', placements: [] })).toEqual(['a=empty']);
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

  it('the results table has no count line, centres each row and puts View details at the end', async () => {
    vi.mocked(api.getFeedback).mockResolvedValue([row('Q1', true), row('Q2', false)] as never);
    await render(<ResultSet />);
    await screen.findByText('Keep');
    expect(screen.queryByText(/you kept/)).toBeNull();
    expect(document.querySelector('table')).toHaveClass('results-table');
    expect(screen.getAllByRole('link', { name: 'View details' })[0]!.closest('td')).toHaveClass('text-right');
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
