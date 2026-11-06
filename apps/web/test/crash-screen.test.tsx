import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from './utils';

vi.mock('@/lib/auth', () => ({ ensureSession: vi.fn(async () => {}), idToken: vi.fn(async () => 't'), renewSession: vi.fn(async () => {}) }));
vi.mock('@/lib/app-version', async (original) => ({ ...(await original<object>()), reloadApp: vi.fn() }));

const { CrashScreen } = await import('@/components/logina/CrashScreen');
const { reloadApp } = await import('@/lib/app-version');

describe('browser translation', () => {
  it('the page tells browsers not to translate it, because LOGINA has its own language switch', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toMatch(/<html[^>]*\btranslate="no"/);
    expect(html).toContain('<meta name="google" content="notranslate" />');
  });
});

describe('crash screen', () => {
  const crash = new Error("Failed to execute 'removeChild' on 'Node'");

  it('says what happened in plain words, never the raw error, and offers Reload', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderWithI18n(<CrashScreen error={crash} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong on this page' })).toBeInTheDocument();
    expect(screen.getByText(/Your saved work is safe/)).toBeInTheDocument();
    expect(screen.queryByText(/removeChild/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reloadApp).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Go to the start page' })).toHaveAttribute('href', '/');
    expect(log).toHaveBeenCalledWith(crash);
    log.mockRestore();
  });

  it('speaks the chosen language', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderWithI18n(<CrashScreen error={crash} />, { lang: 'vi' });
    expect(screen.getByRole('heading', { name: 'Trang này gặp lỗi' })).toBeInTheDocument();
    log.mockRestore();
  });

  it('every screen uses it when something crashes', async () => {
    const { router } = await import('@/router');
    expect(router.options.defaultErrorComponent).toBe(CrashScreen);
  });
});
