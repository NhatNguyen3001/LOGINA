import type { Context, Handler, MiddlewareHandler } from 'hono';
import type { AppDeps, AppEnv } from '../context.js';
import { clientAddress, consume, createApiCounter, hashAddress, RateLimited, type LimitedAction } from '../services/limits.js';

export const keysOf = (c: Context<AppEnv>, now: Date) => {
  const address = clientAddress(c);
  return { sessionKey: c.var.session.uid, addressKey: address ? hashAddress(address) : undefined, now };
};

export async function enforce({ db, config, now }: AppDeps, c: Context<AppEnv>, action: LimitedAction): Promise<void> {
  const at = now();
  const result = await consume(db, action, config.limits[action], keysOf(c, at));
  if (!result.allowed) throw new RateLimited(action, result.resetsAt, at);
}

/** Goes inside `withIdempotency`, so a replay is not counted and a 429 is never stored as the answer to a key. */
export const limited = (deps: AppDeps, action: LimitedAction, handler: Handler<AppEnv>): Handler<AppEnv> =>
  async (c, next) => {
    await enforce(deps, c, action);
    return handler(c, next);
  };

export function apiLimiter({ config, now }: AppDeps): MiddlewareHandler<AppEnv> {
  const counter = createApiCounter(config.limits.API);
  return async (c, next) => {
    const at = now();
    const { sessionKey, addressKey } = keysOf(c, at);
    const blocked = counter.hit(sessionKey, addressKey, at);
    if (blocked) throw new RateLimited('API', blocked.resetsAt, at);
    await next();
  };
}
