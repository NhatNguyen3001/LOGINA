import type { Context, MiddlewareHandler } from 'hono';
import type { AppDeps, AppEnv } from '../context.js';
import { clientAddress, consume, createApiCounter, hashAddress, RateLimited, type LimitedAction } from '../services/limits.js';

export const keysOf = (c: Context<AppEnv>, now: Date, trustedHops: number) => {
  const address = clientAddress(c, trustedHops);
  return { sessionKey: c.var.session.uid, addressKey: address ? hashAddress(address) : undefined, now };
};

export async function enforce({ db, config, now }: AppDeps, c: Context<AppEnv>, action: LimitedAction): Promise<void> {
  const at = now();
  const result = await consume(db, action, config.limits[action], keysOf(c, at, config.trustedProxyHops));
  if (!result.allowed) throw new RateLimited(action, result.resetsAt, at);
}

export function apiLimiter({ config, now }: AppDeps): MiddlewareHandler<AppEnv> {
  const counter = createApiCounter(config.limits.API);
  return async (c, next) => {
    const at = now();
    const { sessionKey, addressKey } = keysOf(c, at, config.trustedProxyHops);
    const blocked = counter.hit(sessionKey, addressKey, at);
    if (blocked) throw new RateLimited('API', blocked.resetsAt, at);
    await next();
  };
}
