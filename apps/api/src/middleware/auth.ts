import type { MiddlewareHandler } from 'hono';
import type { AppDeps, AppEnv } from '../context.js';
import { AppError } from './errors.js';

const unauthenticated = (): AppError => new AppError('UNAUTHENTICATED', 401, 'Sign-in is required.');

export function authenticate({ auth }: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '')?.[1];
    if (!token) throw unauthenticated();
    const decoded = await auth.verifyIdToken(token).catch(() => {
      throw unauthenticated();
    });
    c.set('session', { uid: decoded.uid });
    await next();
  };
}
