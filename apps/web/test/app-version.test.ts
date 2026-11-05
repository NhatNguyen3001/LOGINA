import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type VersionModule = typeof import('@/lib/app-version');

/** Each test loads the module fresh, stamped with the given build. */
async function load(build: string | undefined): Promise<VersionModule> {
  vi.resetModules();
  if (build === undefined) vi.stubEnv('VITE_BUILD_SHA', '');
  else vi.stubEnv('VITE_BUILD_SHA', build);
  return import('@/lib/app-version');
}

const serves = (body: unknown, ok = true) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('app version', () => {
  it('a newer version.json marks the app out of date', async () => {
    const version = await load('abc1234');
    serves({ version: 'def5678' });
    expect(await version.checkForUpdate()).toBe(true);
    expect(renderHook(() => version.useOutdated()).result.current).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
  });

  it('the same version, a failed fetch or a dev build never marks it', async () => {
    let version = await load('abc1234');
    serves({ version: 'abc1234' });
    expect(await version.checkForUpdate()).toBe(false);
    serves({}, false);
    expect(await version.checkForUpdate()).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await version.checkForUpdate()).toBe(false);
    version = await load(undefined);
    expect(version.APP_VERSION).toBe('dev');
    serves({ version: 'def5678' });
    expect(await version.checkForUpdate()).toBe(false);
    expect(renderHook(() => version.useOutdated()).result.current).toBe(false);
  });

  it('an API reply from another version only prompts a check; version.json decides', async () => {
    const version = await load('abc1234');
    serves({ version: 'abc1234' });
    version.noteServerVersion('dev');
    version.noteServerVersion(null);
    version.noteServerVersion('abc1234');
    expect(fetch).not.toHaveBeenCalled();
    version.noteServerVersion('def5678');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(renderHook(() => version.useOutdated()).result.current).toBe(false);
    version.noteServerVersion('def5678');
    expect(fetch).toHaveBeenCalledTimes(1);
    serves({ version: 'def5678' });
    version.noteServerVersion('fff9999');
    await vi.waitFor(() => expect(renderHook(() => version.useOutdated()).result.current).toBe(true));
  });

  it('checks again every 5 minutes and when the tab comes back', async () => {
    vi.useFakeTimers();
    const version = await load('abc1234');
    serves({ version: 'abc1234' });
    const stop = version.startUpdateChecks();
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetch).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
