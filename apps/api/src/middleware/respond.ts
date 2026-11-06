import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import { AppError, OUTDATED_MESSAGE } from './errors.js';

/** The choke point: nothing reaches the browser without passing its strict DTO. Stored content in an older format is the usual cause, so the reader is told to reset. */
export function respond<S extends z.ZodType>(
  c: Context,
  schema: S,
  body: z.infer<S>,
  status: ContentfulStatusCode = 200,
): Response {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error('Response failed its DTO schema', parsed.error.issues);
    throw new AppError('CONTENT_OUTDATED', 409, OUTDATED_MESSAGE);
  }
  return c.json(parsed.data as object, status);
}
