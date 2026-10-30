import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly affectedRefs?: string[],
  ) {
    super(message);
  }
}

/** Error bodies are `{ code, message, affectedRefs? }`; anything else goes to the logs only. */
export function handleError(error: Error, c: Context): Response {
  if (error instanceof AppError) {
    const { code, message, affectedRefs } = error;
    return c.json({ code, message, ...(affectedRefs ? { affectedRefs } : {}) }, error.status);
  }
  console.error(error);
  return c.json({ code: 'INTERNAL', message: GENERIC_MESSAGE }, 500);
}
