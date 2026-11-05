import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadFailed } from '@/components/logina/LoadFailed';
import { lazyScreen } from '@/lib/lazy-screen';
import { ApiError, request } from '@/lib/api';
import * as version from '@/lib/app-version';
import { z } from 'zod';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { renderWithI18n } from './utils';

vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));
vi.mock('@/lib/app-version', async (original) => ({ ...(await original<typeof import('@/lib/app-version')>()), checkForUpdate: vi.fn(async () => false), reloadApp: vi.fn() }));

const replies = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
const withQuery = (ui: React.ReactElement) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

beforeEach(() => vi.mocked(version.checkForUpdate).mockResolvedValue(false));
afterEach(() => vi.unstubAllGlobals());

describe('version clashes', () => {
  it('a refused request from an out-of-date tab becomes APP_UPDATED and offers Reload', async () => {
    replies(400, { code: 'INVALID_REQUEST', message: 'The request is not valid.' });
    vi.mocked(version.checkForUpdate).mockResolvedValue(true);
    const error = await request('/attempts/a/tasks/Q1/lock', z.object({}), { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('APP_UPDATED');
    await renderWithI18n(withQuery(<LoadFailed error={error} onRetry={() => {}} />));
    expect(screen.getByText('LOGINA was updated while you were working. Reload to continue. Your saved work is kept.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(version.reloadApp).toHaveBeenCalled();
  });

  it('a refused request from a current tab keeps its own code', async () => {
    replies(400, { code: 'INVALID_REQUEST', message: 'The request is not valid.' });
    const error = await request('/attempts/a/tasks/Q1/lock', z.object({}), { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('INVALID_REQUEST');
  });

  it('a reply the app cannot read becomes APP_UPDATED only when a newer version is live', async () => {
    replies(200, { surprise: true });
    const strict = z.object({ expected: z.string() });
    expect(((await request('/x', strict, { method: 'GET' }).catch((e: unknown) => e)) as ApiError).code).toBe('RESPONSE_SCHEMA');
    vi.mocked(version.checkForUpdate).mockResolvedValue(true);
    expect(((await request('/x', strict, { method: 'GET' }).catch((e: unknown) => e)) as ApiError).code).toBe('APP_UPDATED');
  });

  it('a screen whose code file is gone shows the update message instead of crashing', async () => {
    vi.mocked(version.checkForUpdate).mockResolvedValue(true);
    const Gone = lazyScreen<'X', object>(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')), 'X');
    await renderWithI18n(<Suspense fallback={null}><Gone /></Suspense>);
    expect(await screen.findByText('This screen is from an older version of LOGINA. Reload to open the latest one.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(version.reloadApp).toHaveBeenCalled();
  });
});
