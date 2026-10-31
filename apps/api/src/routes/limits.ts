import { Hono } from 'hono';
import { LimitsDTO, RateAction } from '@logina/contracts';
import type { AppDeps, AppEnv } from '../context.js';
import { keysOf } from '../middleware/rate-limit.js';
import { respond } from '../middleware/respond.js';
import { peek } from '../services/limits.js';

export function limitRoutes({ db, config, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/', async (c) => {
    const keys = keysOf(c, now(), config.trustedProxyHops);
    const limits = await Promise.all(
      RateAction.options.map(async (action) => {
        const { limit, remaining, resetsAt } = await peek(db, action, config.limits[action], keys);
        return { action, limit, remaining, resetsAt: resetsAt.toISOString() };
      }),
    );
    return respond(c, LimitsDTO, { limits });
  });

  return routes;
}
