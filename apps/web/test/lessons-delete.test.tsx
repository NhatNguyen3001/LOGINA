import type { LessonListDTO } from '@logina/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonsHome } from '@/features/lessons/LessonsHome';
import * as api from '@/lib/api';
import { renderWithI18n } from './utils';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
}));
vi.mock('@/lib/api', async (original) => ({ ...(await original<object>()), getLessons: vi.fn(), deleteLesson: vi.fn() }));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const lesson = (id: string, title: string) => ({ id, title, stage: 'CLARIFY', aiMode: 'LIVE', updatedAt: '2026-11-04T00:00:00.000Z', primaryClassName: '12A3' });
const list = (...lessons: ReturnType<typeof lesson>[]) => ({ lessons }) as LessonListDTO;

const render = () => renderWithI18n(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LessonsHome /></QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getLessons).mockResolvedValue(list(lesson('a', 'Lesson A'), lesson('b', 'Lesson B')));
});

describe('deleting a lesson set', () => {
  it('asks first, names the lesson, then deletes it and refreshes the list', async () => {
    vi.mocked(api.deleteLesson).mockImplementation(async () => {
      vi.mocked(api.getLessons).mockResolvedValue(list(lesson('b', 'Lesson B')));
      return { ok: true };
    });
    await render();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Lesson A' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete “Lesson A”?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete lesson set' }));
    await waitFor(() => expect(api.deleteLesson).toHaveBeenCalledWith('a', expect.any(String)));
    await waitFor(() => expect(screen.queryByText('Lesson A')).toBeNull());
    expect(screen.getByText('Lesson B')).toBeInTheDocument();
  });

  it('Keep it closes the dialog and deletes nothing', async () => {
    await render();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Lesson A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(api.deleteLesson).not.toHaveBeenCalled();
  });

  it('a lesson LOGINA is still working on says so and stays', async () => {
    vi.mocked(api.deleteLesson).mockRejectedValue(new api.ApiError(409, 'JOB_RUNNING'));
    await render();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Lesson A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete lesson set' }));
    expect(await screen.findByText('LOGINA is still working on this lesson.')).toBeInTheDocument();
    expect(screen.getByText('Lesson A')).toBeInTheDocument();
  });

  it('the lesson card still opens the lesson', async () => {
    await render();
    expect(await screen.findByRole('link', { name: /Lesson A/ })).toBeInTheDocument();
    expect(screen.queryByText('12A3')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Lesson A' })).toHaveClass('text-red', 'border-red-line');
  });
});
