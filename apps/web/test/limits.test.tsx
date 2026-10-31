import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusyNote } from '@/components/logina/BusyNote';
import { getLesson, lockTask } from '@/lib/api';
import { setBusy } from '@/lib/busy';
import { renderWithI18n } from './utils';

vi.mock('@/lib/auth', () => ({
  ensureSession: vi.fn(async () => {}),
  idToken: vi.fn(async () => 'token'),
  renewSession: vi.fn(async () => {}),
}));

const busy429 = (action: string) =>
  new Response(JSON.stringify({ code: 'RATE_LIMITED', action, retryAfterSeconds: 0, resetsAt: '2026-11-05T08:40:00.000Z' }), { status: 429 });
const challenge = { deliveryId: 'd', message: 'm', lockedSummary: { answerText: 'a', confidence: 50 } };
const fetchMock = vi.fn<typeof fetch>();
const lockRequest = { artifact: { slot: 'Q1' as const, answerId: 'a', evidenceId: 'e' }, initialConfidence: 50 };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setBusy(false);
});

describe('busy retries', () => {
  it('429 API on lock retries with the same key', async () => {
    fetchMock.mockResolvedValueOnce(busy429('API')).mockResolvedValueOnce(new Response(JSON.stringify(challenge)));
    await lockTask('a', 'Q1', lockRequest, 'key-1');
    const keys = fetchMock.mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(keys).toEqual(['key-1', 'key-1']);
  });

  it('student calls keep retrying past three 429s, and the busy note clears after', async () => {
    const statuses: boolean[] = [];
    for (let i = 0; i < 6; i += 1) fetchMock.mockResolvedValueOnce(busy429('SESSION'));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(challenge)));
    await lockTask('a', 'Q1', lockRequest, 'k');
    statuses.push(fetchMock.mock.calls.length === 7);
    expect(statuses).toEqual([true]);
    await renderWithI18n(<BusyNote side="student" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('teacher calls stop after three retries', async () => {
    fetchMock.mockImplementation(async () => busy429('API'));
    await expect(getLesson('l')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('a limit on one action is not retried', async () => {
    fetchMock.mockResolvedValue(busy429('AI_ACTION'));
    await expect(getLesson('l')).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('BusyNote', () => {
  it('shows only while busy and says nothing about limits', async () => {
    await renderWithI18n(<BusyNote side="student" />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => setBusy(true));
    expect(screen.getByRole('status')).toHaveTextContent('LOGINA is busy right now');
    expect(screen.getByRole('status')).not.toHaveTextContent(/limit/i);
  });
});
