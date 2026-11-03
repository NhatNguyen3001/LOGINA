import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneMenu } from '@/components/logina/MenuButton';
import { renderWithI18n } from './utils';

const src = (path: string) => readFileSync(resolve(process.cwd(), 'src', path), 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('final review fixes', () => {
  it('keyboard focus shows a visible ring on accordion rows, checkboxes and radio cards', () => {
    for (const file of ['components/ui/accordion.tsx', 'components/ui/checkbox.tsx', 'components/ui/radio-group.tsx']) {
      expect(src(file), file).toMatch(/focus-visible:ring-accent(?![\w-])/);
      expect(src(file), file).not.toMatch(/focus-visible:ring-accent-bg/);
    }
  });

  it('on a phone the menu content stays mounted while closed, so the first-visit tour is never trapped inside it', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await renderWithI18n(
      <QueryClientProvider client={new QueryClient()}>
        <PhoneMenu><button type="button">Inside the menu</button></PhoneMenu>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByText('Inside the menu', { selector: 'button' })).toBeInTheDocument();
  });

  it('the dim layer behind panels and dialogs stays dark in dark mode', () => {
    for (const file of ['components/ui/sheet.tsx', 'components/ui/alert-dialog.tsx']) expect(src(file), file).not.toMatch(/bg-ink\/\d+/);
    expect(src('styles/components.css')).not.toMatch(/button\.clip:hover\{color:var\(--accent\)/);
  });

  it('the tab title stays LOGINA on every page', () => {
    expect(readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')).toMatch(/<title>LOGINA<\/title>/);
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)]));
    for (const file of walk(resolve(process.cwd(), 'src')).filter((path) => /\.tsx?$/.test(path))) expect(readFileSync(file, 'utf8'), file).not.toMatch(/document\.title\s*=/);
  });

  it('the reset dialog keeps a gap from the screen edges on a phone', () => {
    expect(src('components/ui/alert-dialog.tsx')).toMatch(/inset-x-4/);
    expect(src('components/ui/alert-dialog.tsx')).not.toMatch(/(^|s)w-full(s|')/);
  });

  it('a toast timer pauses while hovered and the card is announced only once', () => {
    expect(src('components/logina/Toast.tsx')).not.toMatch(/role="status"/);
    expect(src('styles/components.css')).toMatch(/:hover .toast-time{animation-play-state:paused}/);
  });

  it('the copied Tremor components ship with their Apache 2.0 licence', () => {
    const licence = resolve(process.cwd(), 'src/components/tremor/LICENSE');
    expect(existsSync(licence)).toBe(true);
    expect(readFileSync(licence, 'utf8')).toMatch(/Apache License\s+Version 2\.0/);
  });

  it('notes use the Alert styles, because the old note class has no CSS left', () => {
    expect(src('styles/components.css')).not.toMatch(/\.note\b/);
    for (const file of ['features/source/ClarifyPage.tsx', 'components/logina/BusyNote.tsx']) {
      expect(src(file), file).not.toMatch(/['" ]note[ '"]/);
      expect(src(file), file).toMatch(/alertVariants/);
    }
  });

  it('links styled as buttons get the hover too, since a link is never :enabled', () => {
    expect(src('components/ui/button.tsx')).not.toMatch(/enabled:hover:/);
    expect(src('components/ui/button.tsx')).toMatch(/not-disabled:hover:bg-subtle/);
    expect(src('components/logina/BackLink.tsx')).toMatch(/motion-safe:group-hover:-translate-x-0.5/);
  });
});
