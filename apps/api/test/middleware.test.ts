import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { z } from 'zod';
import { anonToken, liveSetup, testSchoolId, type AnonSession, type LiveProject } from '@logina/test-utils';
import { createApp } from '../src/app.js';
import { noFiles } from './helpers.js';
import { testConfig } from '../src/config.js';
import { AppError } from '../src/middleware/errors.js';
import { idempotencyDocId, withIdempotency } from '../src/middleware/idempotency.js';
import { requireBaseVersion, VERSIONED_ROUTES } from '../src/middleware/base-version.js';
import { respond } from '../src/middleware/respond.js';

const Ok = z.object({ ok: z.boolean() }).strict();

let live: LiveProject;
let session: AnonSession;
let app: ReturnType<typeof createApp>;
const prefix = testSchoolId();
const keys: string[] = [];
let calls = 0;

const auth = () => ({ Authorization: `Bearer ${session.idToken}` });
const post = (path: string, body: unknown, key: string) => {
  keys.push(key);
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
};

beforeAll(async () => {
  live = await liveSetup();
  session = await anonToken();
  app = createApp({
    db: live.db,
    auth: getAuth(getApps().find((a) => a.name === 'logina-live-tests')!),
    enqueue: async () => {},
    config: testConfig(),
    files: noFiles,
    now: () => new Date(),
  });
  app.get('/api/v1/test/extra', (c) => respond(c, Ok, { ok: true, secret: 1 } as never));
  app.get('/api/v1/test/boom', () => {
    throw new Error('boom at x.ts:1');
  });
  app.get('/api/v1/test/known', () => {
    throw new AppError('NOT_FOUND', 404, 'Not found');
  });
  app.post(
    '/api/v1/test/once',
    withIdempotency(live.db, async (c) => {
      calls += 1;
      return respond(c, z.object({ calls: z.number() }).strict(), { calls });
    }),
  );
  app.post(
    '/api/v1/test/versioned',
    requireBaseVersion(async () => 5),
    (c) => respond(c, Ok, { ok: true }),
  );
});

afterAll(async () => {
  await Promise.all(keys.map((key) => live.db.doc(`idempotencyKeys/${idempotencyDocId(session.uid, key)}`).delete()));
  await session?.close();
});

describe('API skeleton', () => {
  it('rejects missing token with 401', async () => {
    const response = await app.request('/api/v1/test/known');
    expect(response.status).toBe(401);
  });

  it('rejects a garbage token with 401', async () => {
    const response = await app.request('/api/v1/test/known', { headers: { Authorization: 'Bearer nope' } });
    expect(response.status).toBe(401);
  });

  it('health needs no token', async () => {
    const response = await app.request('/api/v1/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('SEC05 unknown query parameter rejected (400)', async () => {
    const response = await app.request('/api/v1/health?include_internal=true');
    expect(response.status).toBe(400);
  });

  it('response with extra key never reaches client', async () => {
    const response = await app.request('/api/v1/test/extra', { headers: auth() });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'RESPONSE_SCHEMA' });
    expect(body).not.toHaveProperty('secret');
  });

  it('errors carry no stack or internals', async () => {
    const response = await app.request('/api/v1/test/boom', { headers: auth() });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: 'INTERNAL', message: 'Something went wrong. Please try again.' });
  });

  it('AppError keeps its code and status', async () => {
    const response = await app.request('/api/v1/test/known', { headers: auth() });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
  });

  it('API responses are not cacheable', async () => {
    for (const path of ['/api/v1/health', '/api/v1/test/boom', '/api/v1/test/known']) {
      const response = await app.request(path);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
  });

  it('a mutation without Idempotency-Key is 400', async () => {
    const response = await app.request('/api/v1/test/once', { method: 'POST', headers: auth(), body: '{}' });
    expect(response.status).toBe(400);
  });

  it('same Idempotency-Key returns stored response', async () => {
    const key = `${prefix}-same`;
    const first = await (await post('/api/v1/test/once', { a: 1 }, key)).json();
    const second = await (await post('/api/v1/test/once', { a: 1 }, key)).json();
    expect(second).toEqual(first);
  });

  it('same key with different body is 422', async () => {
    const key = `${prefix}-diff`;
    await post('/api/v1/test/once', { a: 1 }, key);
    const response = await post('/api/v1/test/once', { a: 2 }, key);
    expect(response.status).toBe(422);
  });

  it('idempotency record stores requestHash, status, body and expiresAt', async () => {
    const key = `${prefix}-record`;
    await post('/api/v1/test/once', { a: 1 }, key);
    const doc = await live.db.doc(`idempotencyKeys/${idempotencyDocId(session.uid, key)}`).get();
    expect(doc.data()).toMatchObject({ status: 200, requestHash: expect.any(String), body: expect.any(String) });
    expect(doc.data()?.expiresAt.toMillis()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
  });

  it('requireBaseVersion returns 409 on a stale version', async () => {
    const stale = await post('/api/v1/test/versioned', { baseVersion: 4 }, `${prefix}-v1`);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
    const current = await post('/api/v1/test/versioned', { baseVersion: 5 }, `${prefix}-v2`);
    expect(current.status).toBe(200);
  });

  it('requireBaseVersion without baseVersion is 400', async () => {
    const response = await post('/api/v1/test/versioned', {}, `${prefix}-v3`);
    expect(response.status).toBe(400);
  });

  it('VERSIONED_ROUTES lists exactly the seven baseVersion routes', () => {
    expect(VERSIONED_ROUTES).toHaveLength(7);
    expect(VERSIONED_ROUTES).toContain('POST /lessons/:id/assignments');
  });
});
