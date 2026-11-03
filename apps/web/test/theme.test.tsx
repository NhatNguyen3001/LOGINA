import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ModeToggle } from '@/components/logina/ModeToggle';
import { readTheme, setTheme } from '@/lib/theme';
import { renderWithI18n } from './utils';

afterEach(() => act(() => setTheme('light')));

describe('theme', () => {
  it('starts light for someone who never chose', () => {
    localStorage.removeItem('logina.theme');
    expect(readTheme()).toBe('light');
  });

  it('dark and light set the page theme and are remembered', () => {
    act(() => setTheme('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('logina.theme')).toBe('dark');
    act(() => setTheme('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('same as device hands the choice to the device setting', () => {
    act(() => setTheme('system'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readTheme()).toBe('system');
  });

  it('the toggle opens a menu, marks the current theme and switches on Enter', async () => {
    await renderWithI18n(<ModeToggle />);
    const toggle = screen.getByRole('button', { name: 'Theme' });
    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('works in Vietnamese', async () => {
    await renderWithI18n(<ModeToggle />, { lang: 'vi' });
    expect(screen.getByRole('button', { name: 'Giao diện' })).toBeInTheDocument();
  });
});
