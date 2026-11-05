import { useSyncExternalStore } from 'react';

const DEV = 'dev';
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** The commit this build came from. Local builds and tests have none, so they never ask anyone to reload. */
export const APP_VERSION: string = import.meta.env.VITE_BUILD_SHA || DEV;

let outdated = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isOutdated = (): boolean => outdated;

/** Once a newer version is known, the tab stays out of date until it reloads. */
export function markOutdated(): void {
  if (outdated) return;
  outdated = true;
  listeners.forEach((listener) => listener());
}

export const useOutdated = (): boolean => useSyncExternalStore(subscribe, isOutdated);

const isNewer = (version: unknown): boolean => typeof version === 'string' && version !== '' && version !== DEV && APP_VERSION !== DEV && version !== APP_VERSION;

/** Each API reply names the version it runs; a different one means this tab is behind. */
export function noteServerVersion(version: string | null): void {
  if (isNewer(version)) markOutdated();
}

/** Asks the site which version is live. No answer is no news: only a different version marks the tab. */
export async function checkForUpdate(): Promise<boolean> {
  if (outdated) return true;
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return false;
    const { version } = (await response.json()) as { version?: unknown };
    if (!isNewer(version)) return false;
    markOutdated();
    return true;
  } catch {
    return false;
  }
}

/** Checks every 5 minutes and whenever the tab comes back into view. */
export function startUpdateChecks(): () => void {
  const timer = setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Kept apart so tests can watch it without reloading the page. */
export function reloadApp(): void {
  window.location.reload();
}
