import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonToken } from '@logina/test-utils';
import { clientAddress, createApiCounter, consume, defaultLimits, limitsFromEnv, type RateLimits } from '../src/services/limits.js';
import { harness, type Harness } from './helpers.js';

const HOUR = 3600;
const window = (max: number, seconds = HOUR) => ({ max, seconds });

const small: RateLimits = {
  ...defaultLimits,
  SESSION: { perAddress: window(1) },
};

describe('limit values', () => {
  it('defaults are the spec table', () => {
    expect(limitsFromEnv({})).toEqual({
      SESSION: { perAddress: { max: 300, seconds: 3600 } },
      API: { perSession: { max: 600, seconds: 60 }, perAddress: { max: 5000, seconds: 60 } },
    });
  });

  it('each limit reads its env var', () => {
    const limits = limitsFromEnv({
      LIMIT_NEW_SESSIONS_ADDRESS_HOUR: '1',
      LIMIT_API_SESSION_MINUTE: '8',
      LIMIT_API_ADDRESS_MINUTE: '0',
    });
    expect([
      limits.SESSION.perAddress?.max,
      limits.API.perSession?.max,
      limits.API.perAddress?.max,
    ]).toEqual([1, 8, 0]);
  });
});

describe('All API calls', () => {
  const start = new Date('2031-01-01T00:00:00Z');

  it('blocks at 600 per session and resets with the minute', () => {
    const counter = createApiCounter(defaultLimits.API);
    for (let i = 0; i < 600; i += 1) expect(counter.hit('s', 'a', start)).toBeNull();
    expect(counter.hit('s', 'a', start)?.retryAfterSeconds).toBe(60);
    expect(counter.hit('s', 'a', new Date(start.getTime() + 60_000))).toBeNull();
  });

  it('blocks at 5,000 per address across sessions', () => {
    const counter = createApiCounter(defaultLimits.API);
    for (let i = 0; i < 5000; i += 1) expect(counter.hit(`s${i % 100}`, 'a', start)).toBeNull();
    expect(counter.hit('s0', 'a', start)).not.toBeNull();
    expect(counter.hit('other', 'b', start)).toBeNull();
  });

  it('40 sessions on one address complete a set without a block', () => {
    const counter = createApiCounter(defaultLimits.API);
    for (let i = 0; i < 40 * 100; i += 1) expect(counter.hit(`s${i % 40}`, 'a', start)).toBeNull();
  });
});

describe('clientAddress', () => {
  const request = (values: Record<string, string>) => ({ req: { header: (name: string) => values[name.toLowerCase()] } }) as never;

  it('counts from the right, so a forged left entry changes nothing', () => {
    expect(clientAddress(request({ 'x-forwarded-for': 'forged, 2.2.2.2' }), 1)).toBe('2.2.2.2');
    expect(clientAddress(request({ 'x-forwarded-for': 'forged, 2.2.2.2, 3.3.3.3' }), 2)).toBe('2.2.2.2');
    expect(clientAddress(request({ 'fastly-client-ip': 'forged', 'x-forwarded-for': '2.2.2.2' }), 1)).toBe('2.2.2.2');
  });

  it('with no header there is no address', () => {
    expect(clientAddress(request({}), 1)).toBeUndefined();
  });
});

describe('with Firestore', () => {
  let h: Harness;
  const created: string[] = [];
  const NOW = new Date('2031-01-01T00:10:00Z');

  const call = (session: { idToken: string }, path: string, init: { method?: string; address?: string; key?: string } = {}) =>
    h.app.request(`/api/v1${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${session.idToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': init.key ?? randomUUID(),
        ...(init.address ? { 'X-Forwarded-For': init.address } : {}),
      },
      ...(init.method === 'POST' ? { body: '{}' } : {}),
    });

  beforeAll(async () => {
    h = await harness({ limits: small }, { now: () => NOW });
  }, 60_000);

  afterAll(async () => {
    const paths = created.flatMap((uid) => [`schools/wks_${uid}`, `classes/wks_${uid}_12a3`, `users/tch_${uid}`]);
    await Promise.all(paths.map((path) => h.live.db.doc(path).delete()));
    await h.close();
  });

  it('a limit blocks at its exact value and a limit of 0 turns the action off', async () => {
    const keys = { sessionKey: randomUUID(), now: NOW };
    const windows = { perSession: window(2) };
    expect((await consume(h.live.db, 'SESSION', windows, keys)).allowed).toBe(true);
    expect((await consume(h.live.db, 'SESSION', windows, keys)).allowed).toBe(true);
    expect((await consume(h.live.db, 'SESSION', windows, keys)).allowed).toBe(false);
    expect((await consume(h.live.db, 'SESSION', { perSession: window(0) }, { sessionKey: randomUUID(), now: NOW })).allowed).toBe(false);
  });

  it('two concurrent calls at the cap: one allowed', async () => {
    const keys = { sessionKey: randomUUID(), now: NOW };
    const results = await Promise.all([1, 2].map(() => consume(h.live.db, 'SESSION', { perSession: window(1) }, keys)));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });

  it('the tighter window decides, and a blocked address spends no session count', async () => {
    const sessionKey = randomUUID();
    const addressKey = randomUUID();
    const windows = { perSession: window(5), perAddress: window(1) };
    expect(await consume(h.live.db, 'SESSION', windows, { sessionKey, addressKey, now: NOW })).toMatchObject({ allowed: true, limit: 1, remaining: 0 });
    expect((await consume(h.live.db, 'SESSION', windows, { sessionKey, addressKey, now: NOW })).allowed).toBe(false);
    const other = await consume(h.live.db, 'SESSION', windows, { sessionKey, addressKey: randomUUID(), now: NOW });
    expect(other).toMatchObject({ allowed: true, remaining: 0 });
    expect((await consume(h.live.db, 'SESSION', { perSession: window(5) }, { sessionKey, now: NOW })).remaining).toBe(2);
  });

  it('teacher actions have no limit: Reset, Jump and Simulate class repeat freely, and /limits is gone', async () => {
    const one = await h.client();
    for (let i = 0; i < 3; i += 1) expect((await call(one.session, '/demo/reset', { method: 'POST' })).status).toBe(200);
    for (let i = 0; i < 3; i += 1) expect((await call(one.session, '/demo/snapshots/none/restore', { method: 'POST' })).status).toBe(404);
    for (let i = 0; i < 3; i += 1) expect((await one.post('/demo/simulate-class', { assignmentId: 'none' })).status).toBe(404);
    expect((await call(one.session, '/limits')).status).toBe(404);
  });

  it('new sessions block on one address and an existing session is not counted again', async () => {
    const address = `10.1.0.${Math.floor(Math.random() * 250)}`;
    const [first, second] = await Promise.all([anonToken(), anonToken()]);
    created.push(first.uid, second.uid);
    expect((await call(first, '/me', { address })).status).toBe(200);
    expect((await call(first, '/me', { address })).status).toBe(200);
    const blocked = await call(second, '/me', { address });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: 'RATE_LIMITED', action: 'SESSION' });
    expect((await h.live.db.doc(`schools/wks_${second.uid}`).get()).exists).toBe(false);
  });

});
