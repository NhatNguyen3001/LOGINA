import { Hono } from 'hono';
import type { AppDeps, AppEnv } from './context.js';
import { authenticate } from './middleware/auth.js';
import { resolveSession } from './middleware/session.js';
import { handleError } from './middleware/errors.js';
import { rejectUnknownQuery } from './middleware/strict-query.js';
import { healthRoutes } from './routes/health.js';

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'private, no-store');
  });
  app.onError(handleError);
  app.use('/api/v1/*', rejectUnknownQuery);

  app.route('/api/v1/health', healthRoutes());
  app.use('/api/v1/*', authenticate(deps), resolveSession(deps));

  return app;
}
