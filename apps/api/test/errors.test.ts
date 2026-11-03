import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError, handleError } from '../src/middleware/errors.js';

const appThrowing = (error: () => never) => {
  const app = new Hono();
  app.onError(handleError);
  app.get('/x', () => error());
  return app;
};

describe('error replies', () => {
  it('stored data in an older format says the content is out of date, not a crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = appThrowing(() => z.object({ tradeOffs: z.array(z.string()) }).strict().parse({ criteria: [] }) as never);
    const response = await app.request('/x');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: 'CONTENT_OUTDATED', message: 'This content was made with an older version. Reset the demo to get the current version.' });
  });

  it('an unexpected error still answers INTERNAL with no detail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await appThrowing(() => { throw new Error('secret detail'); }).request('/x');
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secret');
  });

  it('a known error keeps its own code', async () => {
    const response = await appThrowing(() => { throw new AppError('ALREADY_LOCKED', 409, 'Already locked'); }).request('/x');
    expect(((await response.json()) as { code: string }).code).toBe('ALREADY_LOCKED');
  });
});
