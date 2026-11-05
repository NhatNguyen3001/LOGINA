import { lazy, type ComponentType } from 'react';
import { ScreenGone } from '@/components/logina/UpdatedNotice';
import { checkForUpdate } from './app-version';

/**
 * Each side loads only its own code, so a student never downloads the teacher screens. When a newer version has
 * replaced a screen's file, the old tab says so instead of crashing; any other failure is thrown as before.
 */
export function lazyScreen<K extends string, P extends object>(load: () => Promise<Record<K, ComponentType<P>>>, name: K) {
  return lazy(async () => {
    try {
      return { default: (await load())[name] };
    } catch (error) {
      if (await checkForUpdate()) return { default: ScreenGone as unknown as ComponentType<P> };
      throw error;
    }
  });
}
