import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));
import { ApiError } from '@/lib/api';
import { jobRefetchInterval } from '@/lib/query';

describe('job polling', () => {
  it('stops polling a job that is gone', () => {
    expect(jobRefetchInterval(undefined, new ApiError(404, 'NOT_FOUND'))).toBe(false);
  });

  it('keeps polling a running job and stops at a final status', () => {
    expect(jobRefetchInterval({ id: 'j', type: 'GENERATE', status: 'RUNNING', steps: [] }, null)).toBe(1500);
    expect(jobRefetchInterval({ id: 'j', type: 'GENERATE', status: 'DONE', steps: [] }, null)).toBe(false);
  });

  it('a dropped connection keeps polling', () => {
    expect(jobRefetchInterval({ id: 'j', type: 'GENERATE', status: 'RUNNING', steps: [] }, new ApiError(503, 'UNAVAILABLE'))).toBe(1500);
  });
});
