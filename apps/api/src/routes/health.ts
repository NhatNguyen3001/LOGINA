import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../context.js';
import { respond } from '../middleware/respond.js';

const HealthDTO = z.object({ ok: z.boolean() }).strict();

export function healthRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/', (c) => respond(c, HealthDTO, { ok: true }));
}
