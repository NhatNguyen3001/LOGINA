import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'logina.theme';
const listeners = new Set<() => void>();

/** Light unless this browser chose otherwise; index.html applies the same rule before the first paint. */
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'dark' || saved === 'system' ? saved : 'light';
  } catch {
    return 'light';
  }
}

let current: Theme = typeof window === 'undefined' ? 'light' : readTheme();

/** Light and dark pin the page; system removes the pin so the device setting decides (tokens.css). */
export function setTheme(next: Theme): void {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // The choice still applies to this page; it is simply not remembered.
  }
  if (next === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  listeners.forEach((listener) => listener());
}

export const useTheme = (): Theme =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
