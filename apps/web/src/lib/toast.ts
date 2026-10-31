import { useSyncExternalStore } from 'react';

const SHOW_MS = 8000;

export interface ToastMessage {
  title: string;
  body: string;
}

let message: ToastMessage | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const announce = () => listeners.forEach((listener) => listener());

export function clearToast(): void {
  clearTimeout(timer);
  message = null;
  announce();
}

/** Lives outside React, so a message survives the page change that follows the action it confirms. */
export function showToast(next: ToastMessage): void {
  clearTimeout(timer);
  message = next;
  timer = setTimeout(clearToast, SHOW_MS);
  announce();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useToast = (): ToastMessage | null => useSyncExternalStore(subscribe, () => message);
