import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
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
