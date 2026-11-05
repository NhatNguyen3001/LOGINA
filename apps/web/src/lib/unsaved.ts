import { useEffect, useSyncExternalStore } from 'react';

let open = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const hasUnsavedText = (): boolean => open > 0;
export const useHasUnsavedText = (): boolean => useSyncExternalStore(subscribe, hasUnsavedText);

/** A text box calls this with whether its text differs from what is saved, so a reload can warn before it is lost. */
export function useUnsavedText(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return undefined;
    open += 1;
    notify();
    return () => {
      open -= 1;
      notify();
    };
  }, [dirty]);
}
