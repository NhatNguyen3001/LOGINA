import { useSyncExternalStore } from 'react';

let busy = false;
const listeners = new Set<() => void>();

export function setBusy(value: boolean): void {
  if (busy === value) return;
  busy = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useBusy = (): boolean => useSyncExternalStore(subscribe, () => busy);
