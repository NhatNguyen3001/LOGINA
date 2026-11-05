import { errorKey } from '@/i18n';
import { ApiError } from './api';

/**
 * Which message an error gets. A request that never reached the server is a connection problem; a server fault is
 * ours, not the connection's; everything else keeps the server's own code.
 */
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.NETWORK';
  if (error.code === 'RATE_LIMITED') return 'errors.RATE_LIMITED';
  if (error.code === 'CONTENT_OUTDATED') return 'errors.CONTENT_OUTDATED';
  if (error.code === 'APP_UPDATED') return 'errors.APP_UPDATED';
  if (error.code === 'INTERNAL' || error.status >= 500) return 'errors.INTERNAL';
  return errorKey(error.code);
}

/** What the person can do about it: try again, start the demo over when its content is out of date, or reload when LOGINA was updated. */
export function errorAction(error: unknown): 'retry' | 'reset' | 'reload' {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.code === 'CONTENT_OUTDATED') return 'reset';
  return error.code === 'APP_UPDATED' ? 'reload' : 'retry';
}
