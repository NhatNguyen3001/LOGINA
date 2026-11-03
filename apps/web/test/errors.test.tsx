import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadFailed } from '@/components/logina/LoadFailed';
import * as api from '@/lib/api';
import { errorText } from '@/lib/errors';
import { reloadHome } from '@/lib/reload-home';
import { renderWithI18n } from './utils';

vi.mock('@/lib/api', async (original) => ({ ...(await original<object>()), demoReset: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/lib/reload-home', () => ({ reloadHome: vi.fn() }));
vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));

const render = (ui: React.ReactElement) => renderWithI18n(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('telling people what went wrong', () => {
  it.each([
    ['no connection', new TypeError('Failed to fetch'), 'errors.NETWORK'],
    ['a server fault', new api.ApiError(500, 'INTERNAL'), 'errors.INTERNAL'],
    ['a busy server', new api.ApiError(429, 'RATE_LIMITED'), 'errors.RATE_LIMITED'],
    ['an out-of-date demo', new api.ApiError(409, 'CONTENT_OUTDATED'), 'errors.CONTENT_OUTDATED'],
    ['a known refusal', new api.ApiError(409, 'ALREADY_LOCKED'), 'errors.ALREADY_LOCKED'],
    ['an unknown code', new api.ApiError(400, 'SOMETHING_NEW'), 'errors.generic'],
  ])('%s gets its own message', (_, error, key) => {
    expect(errorText(error)).toBe(key);
  });

  it('a page that could not load because of the connection says so and offers Try again', async () => {
    const retry = vi.fn();
    await render(<LoadFailed error={new TypeError('Failed to fetch')} onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn\'t reach LOGINA. Check your connection and try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('a server fault does not blame the connection', async () => {
    await render(<LoadFailed error={new api.ApiError(500, 'INTERNAL')} onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on our side. Try again in a moment.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/connection/);
  });

  it('an out-of-date demo explains itself and resets the demo', async () => {
    await render(<LoadFailed error={new api.ApiError(409, 'CONTENT_OUTDATED')} onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/older version of LOGINA/);
    fireEvent.click(screen.getByRole('button', { name: 'Reset the demo' }));
    await waitFor(() => expect(api.demoReset).toHaveBeenCalled());
    await waitFor(() => expect(reloadHome).toHaveBeenCalled());
  });
});
