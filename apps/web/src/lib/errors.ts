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
  if (error.code === 'INTERNAL' || error.status >= 500) return 'errors.INTERNAL';
  return errorKey(error.code);
}

/** What the person can do about it: try again, or start the demo over when its content is out of date. */
export const errorAction = (error: unknown): 'retry' | 'reset' => (error instanceof ApiError && error.code === 'CONTENT_OUTDATED' ? 'reset' : 'retry');
