import type { MeDTO } from '@logina/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Consent } from '@/features/student/Consent';
import { DemoMenu } from '@/components/logina/DemoMenu';
import { EntryPage } from '@/features/entry/EntryPage';
import { LessonsHome } from '@/features/lessons/LessonsHome';
import { OpenAssignment } from '@/features/student/OpenAssignment';
import { stagePath } from '@/features/lessons/stage-path';
import { SwitchSide } from '@/components/logina/SwitchSide';
import * as api from '@/lib/api';
import { renderWithI18n } from './utils';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  useNavigate: () => navigate,
  useParams: () => ({ id: 'asg1' }),
  Navigate: ({ to }: { to: string }) => <p>{`redirect ${to}`}</p>,
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
}));
vi.mock('@/lib/api', async (original) => ({ ...(await original<object>()), getLessons: vi.fn(), getLesson: vi.fn(), getMyAssignments: vi.fn(), getMe: vi.fn(), sendConsent: vi.fn(), getLimits: vi.fn(), getDemoSnapshots: vi.fn(), startAttempt: vi.fn(async () => ({ attemptId: 'att', status: 'NOT_STARTED', slots: [{ slot: 'Q1', phase: 'REASON' }] })) }));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const withQuery = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;

const me = { uid: 'u', role: 'demo', displayName: 'x', schoolId: 's', classIds: ['c'], uiLocale: 'en', demoMenu: true, consentRequired: true, currentConsentVersion: '2026-10-v1' } as MeDTO;
const limits = { limits: [{ action: 'RESET', limit: 1, remaining: 0, resetsAt: new Date(Date.now() + 170_000).toISOString() }, { action: 'SIMULATE_CLASS', limit: 10, remaining: 2, resetsAt: new Date(Date.now() + 3_000_000).toISOString() }] } as never;

beforeEach(() => {
  navigate.mockReset();
  vi.mocked(api.getMe).mockResolvedValue(me);
  vi.mocked(api.getLimits).mockResolvedValue(limits);
  vi.mocked(api.getDemoSnapshots).mockResolvedValue({ snapshots: [{ stepId: 't07', label: 'T7 · Matching Preview' }] });
});

describe('entry', () => {
  it('shows two equal buttons and the demo line, with no sign-in form', async () => {
    await renderWithI18n(withQuery(<EntryPage />));
    const teacher = screen.getByRole('button', { name: 'Try as teacher' });
    const student = screen.getByRole('button', { name: 'Try as student' });
    expect(teacher.className).toBe(student.className);
    expect(screen.getByText(/This is a demo without accounts/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByText(/sign out/i)).toBeNull();
  });

  it('Try as student opens the newest assignment', async () => {
    vi.mocked(api.getMyAssignments).mockResolvedValue({ assignments: [{ assignmentId: 'asg1', lessonTitle: 'L', teacherName: 'T', status: 'NOT_STARTED' }] });
    await renderWithI18n(withQuery(<EntryPage />));
    fireEvent.click(screen.getByRole('button', { name: 'Try as student' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/s/assignments/$id', params: { id: 'asg1' } }));
  });

  it('works in Vietnamese', async () => {
    await renderWithI18n(withQuery(<EntryPage />), { lang: 'vi' });
    expect(screen.getByRole('button', { name: 'Dùng thử với vai trò giáo viên' })).toBeInTheDocument();
  });
});

describe('lessons', () => {
  it('routes by stage', () => {
    expect(stagePath({ id: 'l', stage: 'SOURCE_REVIEW' })).toBe('/t/lessons/l/source');
    expect(stagePath({ id: 'l', stage: 'ASSIGNED', latestAssignmentId: 'a' })).toBe('/t/assignments/a');
    expect(stagePath({ id: 'l', stage: 'ASSIGNED' })).toBe('/t/lessons/l/approve');
  });

  it('home lists uploaded lessons next to Bài 8 with their stage', async () => {
    const base = { updatedAt: '2026-10-31T00:00:00.000Z', primaryClassName: '12A3' };
    vi.mocked(api.getLessons).mockResolvedValue({
      lessons: [
        { ...base, id: 'a', title: 'Bài 8', stage: 'ASSIGNED', aiMode: 'SEEDED', latestAssignmentId: 'x' },
        { ...base, id: 'b', title: 'My file', stage: 'CLARIFY', aiMode: 'LIVE' },
      ],
    });
    await renderWithI18n(withQuery(<LessonsHome />));
    expect(await screen.findByRole('link', { name: /Bài 8/ })).toHaveAttribute('href', '/t/assignments/x');
    expect(screen.getByRole('link', { name: /My file/ })).toHaveAttribute('href', '/t/lessons/b/clarify');
  });
});

describe('switching sides', () => {
  it('opens the lesson assignment in a new tab with noopener', async () => {
    vi.mocked(api.getLesson).mockResolvedValue({ latestAssignmentId: 'asg9' } as never);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await renderWithI18n(withQuery(<SwitchSide to="student" lessonId="l1" />));
    fireEvent.click(screen.getByRole('button', { name: /Open student view/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('/s/assignments/asg9', '_blank', 'noopener'));
  });

  it('with no assigned lesson opens the newest assignment', async () => {
    vi.mocked(api.getMyAssignments).mockResolvedValue({ assignments: [{ assignmentId: 'new1', lessonTitle: 'L', teacherName: 'T', status: 'NOT_STARTED' }] });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await renderWithI18n(withQuery(<SwitchSide to="student" />));
    fireEvent.click(screen.getByRole('button', { name: /Open student view/ }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('/s/assignments/new1', '_blank', 'noopener'));
  });
});

describe('demo menu', () => {
  it('shows Available in 3 min and what is left', async () => {
    await renderWithI18n(withQuery(<DemoMenu assignmentId="a" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Demo menu' }));
    expect(await screen.findByText('Available in 3 min')).toBeInTheDocument();
    expect(screen.getByText('2 left this hour')).toBeInTheDocument();
  });

  it('is hidden when MeDTO.demoMenu is false', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...me, demoMenu: false });
    await renderWithI18n(withQuery(<DemoMenu />));
    await waitFor(() => expect(api.getMe).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Demo menu' })).toBeNull();
  });
});

describe('opening an assignment', () => {
  it('keeps the participant code on screen until the student continues', async () => {
    vi.mocked(api.sendConsent).mockResolvedValue({ consent: 'AGREED', participantCode: 'P-7K2M' });
    vi.mocked(api.getMe).mockResolvedValueOnce({ ...me, consentRequired: true }).mockResolvedValue({ ...me, consentRequired: false, participantCode: 'P-7K2M' });
    await renderWithI18n(withQuery(<OpenAssignment />));
    fireEvent.click(await screen.findByRole('button', { name: "I agree, and I'm 18 or older" }));
    expect(await screen.findByText('P-7K2M')).toBeInTheDocument();
    await waitFor(() => expect(api.getMe).toHaveBeenCalledTimes(2));
    expect(screen.getByText('P-7K2M')).toBeInTheDocument();
    expect(api.startAttempt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to the tasks' }));
    await waitFor(() => expect(api.startAttempt).toHaveBeenCalled());
  });
});

describe('consent', () => {
  it('both buttons have identical classes and the text covers the study', async () => {
    await renderWithI18n(withQuery(<Consent onDone={() => {}} />));
    const agree = await screen.findByRole('button', { name: "I agree, and I'm 18 or older" });
    expect(agree.className).toBe(screen.getByRole('button', { name: 'No thanks, just try it' }).className);
    for (const text of [/Q5/, /2 years/, /withdraw/]) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it('agree sends the current version and shows the participant code', async () => {
    vi.mocked(api.sendConsent).mockResolvedValue({ consent: 'AGREED', participantCode: 'P-7K2M' });
    await renderWithI18n(withQuery(<Consent onDone={() => {}} />));
    fireEvent.click(await screen.findByRole('button', { name: "I agree, and I'm 18 or older" }));
    expect(await screen.findByText('P-7K2M')).toBeInTheDocument();
    expect(vi.mocked(api.sendConsent).mock.calls[0]?.[0]).toEqual({ consentVersion: '2026-10-v1', choice: 'AGREED' });
  });

  it('decline goes straight on', async () => {
    vi.mocked(api.sendConsent).mockResolvedValue({ consent: 'DECLINED' });
    const onDone = vi.fn();
    await renderWithI18n(withQuery(<Consent onDone={onDone} />));
    fireEvent.click(await screen.findByRole('button', { name: 'No thanks, just try it' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
