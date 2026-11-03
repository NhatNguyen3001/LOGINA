import { Check, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';

/** LOGINA's green confirmation card; Sonner places it, times it and stacks it. */
export function ToastCard({ message, onClose }: { message: { title: string; body: string }; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="toast">
      <span className="toast-ic"><Check className="ico" aria-hidden="true" /></span>
      <span className="grow">
        <span className="toast-title">{message.title}</span>
        <span className="toast-body">{message.body}</span>
      </span>
      <button type="button" className="toast-x" aria-label={t('demo.close')} onClick={onClose}>
        <X className="ico" aria-hidden="true" />
      </button>
      <span className="toast-time" aria-hidden="true" />
    </div>
  );
}

/** Mounted once at the root, so a message outlives the page that raised it. */
export function Toast() {
  return <Toaster position="top-center" offset={20} style={{ '--width': 'min(520px, calc(100vw - 32px))' } as CSSProperties} toastOptions={{ unstyled: true }} />;
}
