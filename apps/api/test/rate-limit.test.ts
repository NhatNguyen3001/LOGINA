import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { LimitsDTO, RateLimitDTO } from '@logina/contracts';
import { anonToken } from '@logina/test-utils';
import { clientAddress, createApiCounter, consume, defaultLimits, limitsFromEnv, type RateLimits } from '../src/services/limits.js';
import { harness, minimalLesson, type Client, type Harness } from './helpers.js';

const HOUR = 3600;
const window = (max: number, seconds = HOUR) => ({ max, seconds });

const small: RateLimits = {
  ...defaultLimits,
  UPLOAD: { perSession: window(1), perAddress: window(30) },
  AI_ACTION: { perSession: window(2), perAddress: window(3) },
  SIMULATE_CLASS: { perSession: window(1) },
  SESSION: { perAddress: window(1) },
};

describe('limit values', () => {
  it('defaults are the spec table', () => {
    expect(limitsFromEnv({})).toEqual({
      SESSION: { perAddress: { max: 300, seconds: 3600 } },
      UPLOAD: { perSession: { max: 5, seconds: 3600 }, perAddress: { max: 30, seconds: 3600 } },
      AI_ACTION: { perSession: { max: 50, seconds: 3600 }, perAddress: { max: 200, seconds: 3600 } },
      RESET: { perSession: { max: 1, seconds: 300 } },
      SIMULATE_CLASS: { perSession: { max: 10, seconds: 3600 } },
      API: { perSession: { max: 600, seconds: 60 }, perAddress: { max: 5000, seconds: 60 } },
    });
  });

  it('each limit reads its env var', () => {
    const limits = limitsFromEnv({
      LIMIT_NEW_SESSIONS_ADDRESS_HOUR: '1',
      LIMIT_UPLOAD_SESSION_HOUR: '2',
      LIMIT_UPLOAD_ADDRESS_HOUR: '3',
      LIMIT_AI_SESSION_HOUR: '4',
      LIMIT_AI_ADDRESS_HOUR: '5',
      LIMIT_RESET_SESSION_5MIN: '6',
      LIMIT_SIMULATE_SESSION_HOUR: '7',
      LIMIT_API_SESSION_MINUTE: '8',
      LIMIT_API_ADDRESS_MINUTE: '0',
    });
    expect([
      limits.SESSION.perAddress?.max,
      limits.UPLOAD.perSession?.max,
      limits.UPLOAD.perAddress?.max,
      limits.AI_ACTION.perSession?.max,
      limits.AI_ACTION.perAddress?.max,
      limits.RESET.perSession?.max,
      limits.SIMULATE_CLASS.perSession?.max,
      limits.API.perSession?.max,
      limits.API.perAddress?.max,
    ]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
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
  it('prefers the header the CDN sets, then the first forwarded address, then nothing', () => {
    const request = (values: Record<string, string>) => ({ req: { header: (name: string) => values[name.toLowerCase()] } }) as never;
    expect(clientAddress(request({ 'fastly-client-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientAddress(request({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2');
    expect(clientAddress(request({}))).toBeUndefined();
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

  const limitOf = async (client: Client, action: string, address?: string) =>
    LimitsDTO.parse(await (await call(client.session, '/limits', address ? { address } : {})).json()).limits.find((l) => l.action === action)!;

  const failingAiCall = (client: Client, address?: string) =>
    call(client.session, '/lessons/none/tasks/Q1/rerun', { method: 'POST', ...(address ? { address } : {}) });

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
    expect((await consume(h.live.db, 'RESET', windows, keys)).allowed).toBe(true);
    expect((await consume(h.live.db, 'RESET', windows, keys)).allowed).toBe(true);
    expect((await consume(h.live.db, 'RESET', windows, keys)).allowed).toBe(false);
    expect((await consume(h.live.db, 'RESET', { perSession: window(0) }, { sessionKey: randomUUID(), now: NOW })).allowed).toBe(false);
  });

  it('two concurrent calls at the cap: one allowed', async () => {
    const keys = { sessionKey: randomUUID(), now: NOW };
    const results = await Promise.all([1, 2].map(() => consume(h.live.db, 'RESET', { perSession: window(1) }, keys)));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });

  it('the tighter window decides, and a blocked address spends no session count', async () => {
    const sessionKey = randomUUID();
    const addressKey = randomUUID();
    const windows = { perSession: window(5), perAddress: window(1) };
    expect(await consume(h.live.db, 'AI_ACTION', windows, { sessionKey, addressKey, now: NOW })).toMatchObject({ allowed: true, limit: 1, remaining: 0 });
    expect((await consume(h.live.db, 'AI_ACTION', windows, { sessionKey, addressKey, now: NOW })).allowed).toBe(false);
    const other = await consume(h.live.db, 'AI_ACTION', windows, { sessionKey, addressKey: randomUUID(), now: NOW });
    expect(other).toMatchObject({ allowed: true, remaining: 0 });
    expect((await consume(h.live.db, 'AI_ACTION', { perSession: window(5) }, { sessionKey, now: NOW })).remaining).toBe(2);
  });

  it('a second Reset is 429 with Retry-After, Jump shares the limit, and a replay is not counted', async () => {
    const one = await h.client();
    const key = randomUUID();
    expect((await call(one.session, '/demo/reset', { method: 'POST', key })).status).toBe(200);
    expect((await call(one.session, '/demo/reset', { method: 'POST', key })).status).toBe(200);
    const blocked = await call(one.session, '/demo/snapshots/none/restore', { method: 'POST' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBe(300);
    expect(RateLimitDTO.parse(await blocked.json())).toMatchObject({ action: 'RESET', retryAfterSeconds: 300 });
  });

  it('Simulate class blocks at its limit', async () => {
    const one = await h.client();
    expect((await one.post('/demo/simulate-class', { assignmentId: 'none' })).status).toBe(404);
    expect((await one.post('/demo/simulate-class', { assignmentId: 'none' })).status).toBe(429);
  });

  it('a call that fails after the check still counts', async () => {
    const one = await h.client();
    expect((await failingAiCall(one)).status).toBe(404);
    expect(await limitOf(one, 'AI_ACTION')).toMatchObject({ limit: 2, remaining: 1 });
  });

  it('GET /limits reports the tighter figure and does not consume', async () => {
    const [one, two] = [await h.client(), await h.client()];
    const address = `10.0.0.${Math.floor(Math.random() * 250)}`;
    await failingAiCall(one, address);
    await failingAiCall(two, address);
    await failingAiCall(two, address);
    expect(await limitOf(one, 'AI_ACTION', address)).toMatchObject({ limit: 3, remaining: 0 });
    expect(await limitOf(one, 'AI_ACTION', address)).toMatchObject({ limit: 3, remaining: 0 });
    expect((await limitOf(one, 'RESET')).resetsAt).toBe('2031-01-01T00:15:00.000Z');
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

  it('the sample is never blocked, and a blocked upload leaves no file and no material', async () => {
    const one = await h.client();
    const lesson = (await (await one.post('/lessons', minimalLesson(one.workspace.classId))).json()) as { id: string };
    const pdf = await PDFDocument.create();
    pdf.addPage();

    const upload = async () => {
      const bytes = Buffer.from(await pdf.save());
      const url = await one.post(`/lessons/${lesson.id}/materials/upload-url`, { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: bytes.length });
      const { uploadId } = (await url.json()) as { uploadId: string };
      const path = `uploads/${lesson.id}/${uploadId}.pdf`;
      await h.live.bucket.file(path).save(bytes);
      return { path, response: await one.post(`/lessons/${lesson.id}/materials`, { uploadId, title: 'Material' }) };
    };

    expect((await upload()).response.status).toBe(201);
    pdf.addPage();
    const { path, response } = await upload();
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ action: 'UPLOAD' });
    expect((await h.live.bucket.file(path).exists())[0]).toBe(false);
    expect((await h.live.db.collection(`lessons/${lesson.id}/materialVersions`).get()).size).toBe(1);
    expect((await one.post(`/lessons/${lesson.id}/materials`, { sample: true })).status).toBe(201);
  }, 60_000);
});
