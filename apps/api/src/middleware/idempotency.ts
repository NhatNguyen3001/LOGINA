import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { Context, Handler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { canonicalHash } from '@logina/domain';
import type { AppEnv } from '../context.js';
import { AppError } from './errors.js';

const TTL_MS = 24 * 60 * 60 * 1000;

/** Per session, so two browsers can never collide on a key. */
export const idempotencyDocId = (uid: string, key: string): string =>
  createHash('sha256').update(`${uid}:${key}`).digest('hex');

async function jsonBody(c: Context): Promise<unknown> {
  const text = await c.req.raw.clone().text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('INVALID_JSON', 400, 'The request body is not valid JSON.');
  }
}

export function withIdempotency(db: Firestore, handler: Handler<AppEnv>): Handler<AppEnv> {
  return async (c, next) => {
    const key = c.req.header('Idempotency-Key');
    if (!key) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key header is required.');

    const ref = db.doc(`idempotencyKeys/${idempotencyDocId(c.var.session.uid, key)}`);
    const requestHash = canonicalHash({ method: c.req.method, path: c.req.path, body: await jsonBody(c) });

    const stored = (await ref.get()).data();
    if (stored && stored.expiresAt.toMillis() > Date.now()) {
      if (stored.requestHash !== requestHash) {
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 422, 'This key was used for a different request.');
      }
      return c.json(JSON.parse(stored.body), stored.status as ContentfulStatusCode);
    }

    const response = await handler(c, next);
    if (!response) throw new AppError('INTERNAL', 500, 'Something went wrong. Please try again.');
    if (response.status < 500) {
      await ref.set({
        requestHash,
        status: response.status,
        body: await response.clone().text(),
        expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
      });
    }
    return response;
  };
}
