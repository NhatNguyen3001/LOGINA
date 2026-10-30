import { Hono } from 'hono';
import type { AppDeps, AppEnv } from './context.js';
import { authenticate } from './middleware/auth.js';
import { resolveSession } from './middleware/session.js';
import { handleError } from './middleware/errors.js';
import { rejectUnknownQuery } from './middleware/strict-query.js';
import { classRoutes } from './routes/classes.js';
import { editRoutes } from './routes/edits.js';
import { healthRoutes } from './routes/health.js';
import { jobRoutes } from './routes/jobs.js';
import { lessonRoutes } from './routes/lessons.js';
import { materialRoutes } from './routes/materials.js';
import { sourceRoutes } from './routes/source.js';
import { taskRoutes } from './routes/tasks.js';

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

  app.route('/api/v1/lessons', lessonRoutes(deps));
  app.route('/api/v1/lessons', materialRoutes(deps));
  app.route('/api/v1/lessons', sourceRoutes(deps));
  app.route('/api/v1/lessons', taskRoutes(deps));
  app.route('/api/v1/lessons', editRoutes(deps));
  app.route('/api/v1/classes', classRoutes(deps));
  app.route('/api/v1/jobs', jobRoutes(deps));

  return app;
}
