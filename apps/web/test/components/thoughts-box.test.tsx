import { act, fireEvent, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ThoughtsBox } from '@/components/logina/ThoughtsBox';
import { renderWithI18n } from '../utils';

/** jsdom has no layout, so the box's size and scroll position are set by hand. */
function geometry(el: HTMLElement, start: { height: number; client: number; top: number }) {
  let { height, top } = start;
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => start.client });
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (value: number) => { top = value; } });
  const scrollTo = vi.fn(({ top: next }: { top: number }) => {
    top = next;
    el.dispatchEvent(new Event('scroll'));
  });
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
  return {
    scrollTo,
    top: () => top,
    grow: (to: number) => { height = to; },
    scrollUp: () => { top = 0; fireEvent.scroll(el); },
  };
}

const items = (count: number) => Array.from({ length: count }, (_, index) => <li key={index}>Thought {index + 1}</li>);

async function box(follow: boolean, count = 2) {
  const view = await renderWithI18n(<ThoughtsBox label="AI thoughts for Reading" follow={follow} count={count}><ol>{items(count)}</ol></ThoughtsBox>);
  const region = screen.getByRole('region', { name: 'AI thoughts for Reading' });
  const rerender = (next: number) => view.rerender(<I18nextProvider i18n={i18n}><ThoughtsBox label="AI thoughts for Reading" follow={follow} count={next}><ol>{items(next)}</ol></ThoughtsBox></I18nextProvider>);
  return { region, rerender };
}

describe('ThoughtsBox', () => {
  it('puts the thoughts in a labelled scroll region', async () => {
    const { region } = await box(true);
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveTextContent('Thought 2');
  });

  it('follows new thoughts while the teacher is at the bottom', async () => {
    const { region, rerender } = await box(true);
    const g = geometry(region, { height: 500, client: 280, top: 220 });
    g.grow(700);
    act(() => rerender(3));
    expect(g.top()).toBe(700);
    expect(screen.queryByRole('button', { name: /Jump to latest/ })).toBeNull();
  });

  it('stops following after the teacher scrolls up and offers Jump to latest with a count', async () => {
    const { region, rerender } = await box(true);
    const g = geometry(region, { height: 500, client: 280, top: 220 });
    act(() => g.scrollUp());
    g.grow(800);
    act(() => rerender(4));
    expect(g.top()).toBe(0);
    const jump = screen.getByRole('button', { name: '2 new · Jump to latest' });
    act(() => fireEvent.click(jump));
    expect(g.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 800 }));
    expect(screen.queryByRole('button', { name: /Jump to latest/ })).toBeNull();
  });

  it('a finished step keeps its box but never jumps', async () => {
    const { region, rerender } = await box(false);
    const g = geometry(region, { height: 500, client: 280, top: 220 });
    act(() => g.scrollUp());
    g.grow(800);
    act(() => rerender(4));
    expect(g.top()).toBe(0);
    expect(screen.queryByRole('button', { name: /Jump to latest/ })).toBeNull();
  });

  it('fades the edge that has more to read', async () => {
    const { region } = await box(true);
    const g = geometry(region, { height: 500, client: 280, top: 0 });
    act(() => { fireEvent.scroll(region); });
    expect(region).toHaveClass('thoughts-fade-b');
    expect(region).not.toHaveClass('thoughts-fade-t');
    act(() => { g.grow(500); region.scrollTop = 220; fireEvent.scroll(region); });
    expect(region).toHaveClass('thoughts-fade-t');
    expect(region).not.toHaveClass('thoughts-fade-b');
  });
});
