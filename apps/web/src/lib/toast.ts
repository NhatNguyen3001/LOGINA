import { createElement } from 'react';
import { toast } from 'sonner';
import { ToastCard } from '@/components/logina/Toast';

const SHOW_MS = 8000;
const ID = 'logina-toast';

export interface ToastMessage {
  title: string;
  body: string;
}

export function clearToast(): void {
  toast.dismiss(ID);
}

/** Sonner keeps the message outside React, so it survives the page change that follows the action it confirms. */
export function showToast(next: ToastMessage): void {
  toast.custom(() => createElement(ToastCard, { message: next, onClose: clearToast }), { id: ID, duration: SHOW_MS });
}
