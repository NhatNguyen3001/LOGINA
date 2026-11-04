import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LegalPage } from '@/features/legal/LegalPage';
import { renderWithI18n } from './utils';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const render = (doc: 'privacy' | 'terms' | 'accessibility', lang: 'en' | 'vi' = 'en') =>
  renderWithI18n(<QueryClientProvider client={new QueryClient()}><LegalPage doc={doc} /></QueryClientProvider>, { lang });

describe('policy pages', () => {
  it.each(['privacy', 'terms', 'accessibility'] as const)('%s renders in English without a session', async (doc) => {
    await render(doc);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/LOGINA/);
  });

  it('shows Vietnamese in Vietnamese', async () => {
    await render('privacy', 'vi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chính sách quyền riêng tư');
  });

  it('keeps a heading and its text apart, and shows tables as tables', async () => {
    await render('privacy');
    expect(screen.getByRole('heading', { level: 2, name: '1. Who we are' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Category', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Technical logs', hidden: true })).toBeInTheDocument();
  });

  it.each(['privacy', 'terms', 'accessibility'] as const)('%s shows no unfinished notes in either language', async (doc) => {
    for (const lang of ['en', 'vi'] as const) {
      const { container, unmount } = await render(doc, lang);
      expect(container.querySelector('main')!.textContent).not.toMatch(/\[[^\]]*\]/);
      unmount();
    }
  });

  it('folds every section until it is opened', async () => {
    const { container } = await render('terms');
    const sections = [...container.querySelectorAll('[data-slot="accordion-trigger"]')];
    expect(sections).toHaveLength(9);
    expect(sections.every((section) => section.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(sections[0]).toHaveTextContent('1. About LOGINA');
  });

  it('Back goes to the previous page, not the start', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3);
    await render('terms');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('the privacy policy holds the study details from the consent page, in both languages', async () => {
    const { unmount } = await render('privacy');
    fireEvent.click(screen.getByRole('button', { name: '13. The research study' }));
    for (const text of ['Where the data goes.', 'How long it is kept.', 'Who runs it.', /no more than 2 years/, /never one person/]) expect(screen.getByText(text, { exact: false })).toBeVisible();
    unmount();
    await render('privacy', 'vi');
    fireEvent.click(screen.getByRole('button', { name: '13. Nghiên cứu' }));
    expect(screen.getByText(/không quá 2 năm/)).toBeVisible();
  });

  it.each(['privacy', 'terms', 'accessibility'] as const)('%s lists its version, date and contact on their own lines, with no dots', async (doc) => {
    for (const lang of ['en', 'vi'] as const) {
      const { container, unmount } = await render(doc, lang);
      const meta = [...container.querySelectorAll('.policy-meta')];
      expect(meta.length).toBeGreaterThanOrEqual(2);
      expect(container.querySelector('main')!.textContent).not.toContain('·');
      unmount();
    }
  });

  it('marks a draft policy as a draft', async () => {
    await render('privacy');
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});

describe('production bundle', () => {
  const dist = resolve(process.cwd(), 'dist/assets');

  it.runIf(existsSync(dist))('contains no restricted keys or fixture data', () => {
    const text = readdirSync(dist).filter((name) => name.endsWith('.js')).map((name) => readFileSync(resolve(dist, name), 'utf8')).join('\n');
    for (const secret of ['answerCorrectness', 'pairAlignment', 'qualityRelativeToCorrectA', 'acceptedOrders', 'keywordPartitions']) {
      expect(text).not.toContain(secret);
    }
  });
});
