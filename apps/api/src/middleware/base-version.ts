import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../context.js';
import { AppError } from './errors.js';

/** 02-TRD section 4. Every other mutation is Idempotency-Key only. */
export const VERSIONED_ROUTES = [
  'POST /lessons/:id/issues/:issueId/resolve',
  'POST /lessons/:id/source-approval',
  'POST /lessons/:id/edits',
  'POST /lessons/:id/tasks/:slot/dispositions',
  'POST /lessons/:id/tasks/:slot/sufficiency-choice',
  'POST /lessons/:id/tasks/:slot/approve',
  'POST /lessons/:id/assignments',
] as const;

export function requireBaseVersion(resolve: (c: Context<AppEnv>) => Promise<number>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const body = (await c.req.raw.clone().json()) as { baseVersion?: unknown; expectedDraftVersion?: unknown };
    const version = body.baseVersion ?? body.expectedDraftVersion;
    if (typeof version !== 'number') throw new AppError('BASE_VERSION_REQUIRED', 400, 'baseVersion is required.');
    if (version !== (await resolve(c))) throw new AppError('VERSION_CONFLICT', 409, 'A newer version exists.');
    await next();
  };
}
