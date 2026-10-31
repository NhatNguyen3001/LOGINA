import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { clearToast, useToast } from '@/lib/toast';

export function Toast() {
  const { t } = useTranslation();
  const message = useToast();
  return (
    <div role="status" className="toast-slot">
      {message ? (
        <div className="toast">
          <span className="toast-ic"><Check className="ico" aria-hidden="true" /></span>
          <span className="grow">
            <span className="toast-title">{message.title}</span>
            <span className="toast-body">{message.body}</span>
          </span>
          <button type="button" className="toast-x" aria-label={t('demo.close')} onClick={clearToast}>
            <X className="ico" aria-hidden="true" />
          </button>
          <span className="toast-time" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
