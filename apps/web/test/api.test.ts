import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { examples } from '@logina/contracts/examples';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, approveSource, assignLesson, createLesson, getStudentTask, lockTask, registerMaterial, sendEdit, startAnalyze, tryCase } from '@/lib/api';
import { renewSession } from '@/lib/auth';
import { jobPollInterval } from '@/lib/query';

vi.mock('@/lib/auth', () => ({
  ensureSession: vi.fn(async () => {}),
  idToken: vi.fn(async () => 'token'),
  renewSession: vi.fn(async () => {}),
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn<typeof fetch>();

const sent = (call = 0) => {
  const [url, init] = fetchMock.mock.calls[call]!;
  return { url, headers: init?.headers as Record<string, string>, body: JSON.parse((init?.body as string) ?? '{}') };
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(renewSession).mockClear();
});

describe('api client', () => {
  it('rejects a response with an unknown key', async () => {
    fetchMock.mockResolvedValue(json({ ...examples.studentTask, correctAnswerId: 'x' }));
    await expect(getStudentTask('a', 'Q1')).rejects.toMatchObject({ code: 'RESPONSE_SCHEMA' });
  });

  it('maps 409 to ApiError with affectedRefs', async () => {
    fetchMock.mockResolvedValue(json({ code: 'VERSION_CONFLICT', message: 'x', affectedRefs: ['A4'] }, 409));
    const error = await approveSource('l', 1, 'k').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'VERSION_CONFLICT', affectedRefs: ['A4'] });
  });

  it('sends Idempotency-Key and Authorization', async () => {
    fetchMock.mockResolvedValue(json({ sourceModelVersionId: 's', version: 1, jobId: 'j' }));
    await approveSource('l', 3, 'key-1');
    expect(sent().headers).toMatchObject({ Authorization: 'Bearer token', 'Idempotency-Key': 'key-1' });
    expect(sent().body).toEqual({ baseVersion: 3 });
  });

  it('student runtime calls send no baseVersion', async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await lockTask('a', 'Q1', { artifact: { slot: 'Q1', answerId: 'x', evidenceId: 'y' }, initialConfidence: 50 }, 'k').catch(() => {});
    expect(sent().body).not.toHaveProperty('baseVersion');
  });

  it('createLesson, startAnalyze and tryCase send no baseVersion', async () => {
    fetchMock.mockImplementation(async () => json({}, 500));
    await createLesson({ title: 't', subject: 's', topic: 't', level: 'basic', primaryClassId: 'c', objective: 'o' }, 'k').catch(() => {});
    await startAnalyze('l', 'k').catch(() => {});
    await tryCase('l', 'Q1', { answerId: 'a', evidenceId: 'e' }, 'k').catch(() => {});
    for (const call of [0, 1, 2]) expect(sent(call).body).not.toHaveProperty('baseVersion');
  });

  it('edits and assignments carry the baseVersion they were given', async () => {
    fetchMock.mockImplementation(async () => json({}, 500));
    await sendEdit('l', { editScope: 'CONTENT', targetType: 'answerOption', targetId: 'd', changedRefs: ['A4'], baseVersion: 3, payload: { optionId: 'A4', text: 'x' } }, 'k').catch(() => {});
    await assignLesson('l', { classId: 'c', baseVersion: 9 }, 'k').catch(() => {});
    expect(sent(0).body.baseVersion).toBe(3);
    expect(sent(1).body.baseVersion).toBe(9);
  });

  it.each(['FILE_TYPE', 'FILE_TOO_LARGE', 'TOO_MANY_PAGES', 'UNREADABLE', 'DAILY_LIMIT'])('registerMaterial refusal %s keeps its code and detail', async (code) => {
    fetchMock.mockResolvedValue(json({ code, detail: { pages: 12 } }, code === 'DAILY_LIMIT' ? 429 : 422));
    await expect(registerMaterial('l', { sample: true }, 'k')).rejects.toMatchObject({ code, detail: { pages: 12 } });
  });

  it('a 401 renews the session and retries once', async () => {
    fetchMock.mockResolvedValueOnce(json({ code: 'UNAUTHENTICATED' }, 401));
    fetchMock.mockResolvedValueOnce(json(examples.studentTask));
    await expect(getStudentTask('a', 'Q1')).resolves.toBeDefined();
    expect(renewSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a second 401 stops', async () => {
    fetchMock.mockImplementation(async () => json({ code: 'UNAUTHENTICATED' }, 401));
    await expect(getStudentTask('a', 'Q1')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a 429 keeps the rate limit details', async () => {
    const body = { code: 'RATE_LIMITED', action: 'AI_ACTION', retryAfterSeconds: 720, resetsAt: '2026-11-05T08:40:00.000Z' };
    fetchMock.mockResolvedValue(json(body, 429));
    await expect(approveSource('l', 1, 'k')).rejects.toMatchObject({ status: 429, rateLimit: body });
  });
});

describe('job polling', () => {
  it('polls while running, pauses on NEEDS_INPUT and stops when finished', () => {
    const job = (status: string) => ({ ...examples.job, status }) as never;
    expect(jobPollInterval(job('RUNNING'))).toBe(1500);
    expect(jobPollInterval(job('NEEDS_INPUT'))).toBe(false);
    for (const status of ['DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED']) expect(jobPollInterval(job(status))).toBe(false);
  });
});

describe('bundle', () => {
  it('main.tsx never imports examples or mocks', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    expect(source).not.toMatch(/examples|mocks/);
  });
});
