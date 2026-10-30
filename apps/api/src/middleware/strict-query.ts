import type { MiddlewareHandler } from 'hono';
import { AppError } from './errors.js';

/** SEC05: no route takes query parameters, so none can act as a hidden flag. */
export const rejectUnknownQuery: MiddlewareHandler = async (c, next) => {
  if (new URL(c.req.url).search !== '') throw new AppError('UNKNOWN_QUERY', 400, 'Unknown query parameter.');
  await next();
};
