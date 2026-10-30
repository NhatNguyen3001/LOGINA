import type { Context } from 'hono';
import { AppError } from '@logina/db';

import { MaterialRefusal } from '../services/materials.js';

export { AppError };

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** Error bodies are `{ code, message, affectedRefs? }`; anything else goes to the logs only. */
export function handleError(error: Error, c: Context): Response {
  if (error instanceof MaterialRefusal) return c.json(error.refusal, error.status);
  if (error instanceof AppError) {
    const { code, message, affectedRefs } = error;
    return c.json({ code, message, ...(affectedRefs ? { affectedRefs } : {}) }, error.status);
  }
  console.error(error);
  return c.json({ code: 'INTERNAL', message: GENERIC_MESSAGE }, 500);
}
