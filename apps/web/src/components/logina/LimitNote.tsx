import type { RateAction } from '@logina/contracts';
import { useTranslation } from 'react-i18next';
import { limitState, minutesUntil, useLimit } from '@/lib/limits';
import { Note } from './Note';

const KEYS: Partial<Record<RateAction, { almost: string; reached: string }>> = {
  UPLOAD: { almost: 'limits.uploadAlmost', reached: 'limits.uploadReached' },
  AI_ACTION: { almost: 'limits.aiAlmost', reached: 'limits.aiReached' },
};

/** Sits next to the action it warns about. Never rendered on the student side. */
export function LimitNote({ action }: { action: RateAction }) {
  const { t, i18n } = useTranslation();
  const limit = useLimit(action);
  const keys = KEYS[action];
  if (!limit || !keys) return null;
  const state = limitState(limit);
  if (state === 'ok') return null;
  const time = new Date(limit.resetsAt).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });
  return (
    <Note kind={state === 'reached' ? 'err' : 'warn'}>
      {t(state === 'reached' ? keys.reached : keys.almost, { count: limit.remaining, time, minutes: minutesUntil(limit.resetsAt) })}
    </Note>
  );
}
