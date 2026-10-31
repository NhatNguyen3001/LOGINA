import { createHash } from 'node:crypto';
import { Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

export interface Window {
  max: number;
  seconds: number;
}

export interface ActionWindows {
  perSession?: Window;
  perAddress?: Window;
}

/** `API` and `SESSION` never appear in `GET /limits`; they exist only as 429 values. */
export type LimitedAction = 'API' | 'SESSION';
export type RateLimits = Record<LimitedAction, ActionWindows>;

interface Keys {
  sessionKey: string;
  addressKey?: string | undefined;
  now: Date;
}

export interface LimitState {
  limit: number;
  remaining: number;
  resetsAt: Date;
}

const HOUR = 3600;
const MINUTE = 60;
const MAX_API_ENTRIES = 100_000;

type Env = Record<string, string | undefined>;

export function limitsFromEnv(env: Env): RateLimits {
  const value = (name: string, fallback: number): number => Number(env[name] ?? fallback);
  return {
    SESSION: { perAddress: { max: value('LIMIT_NEW_SESSIONS_ADDRESS_HOUR', 300), seconds: HOUR } },
    API: {
      perSession: { max: value('LIMIT_API_SESSION_MINUTE', 600), seconds: MINUTE },
      perAddress: { max: value('LIMIT_API_ADDRESS_MINUTE', 5000), seconds: MINUTE },
    },
  };
}

export const defaultLimits = limitsFromEnv({});

export class RateLimited extends Error {
  readonly retryAfterSeconds: number;

  constructor(
    readonly action: LimitedAction,
    readonly resetsAt: Date,
    now: Date,
  ) {
    super('RATE_LIMITED');
    this.retryAfterSeconds = Math.ceil((resetsAt.getTime() - now.getTime()) / 1000);
  }
}

const windowEnd = (window: Window, now: Date): Date => {
  const ms = window.seconds * 1000;
  return new Date((Math.floor(now.getTime() / ms) + 1) * ms);
};

/**
 * Counted from the right of X-Forwarded-For, because a client can write anything on the left.
 * `trustedHops` is how many entries our own proxies added. Absent, only the session limits apply.
 */
export function clientAddress(c: { req: { header: (name: string) => string | undefined } }, trustedHops: number): string | undefined {
  const entries = c.req.header('x-forwarded-for')?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? [];
  return entries[entries.length - trustedHops] ?? entries[0];
}

export const hashAddress = (address: string): string => createHash('sha256').update(address).digest('hex');

interface Bucket {
  ref: DocumentReference;
  window: Window;
  resetsAt: Date;
}

function bucketsFor(db: Firestore, action: LimitedAction, windows: ActionWindows, { sessionKey, addressKey, now }: Keys): Bucket[] {
  const scoped: [string, Window | undefined][] = [
    [`s_${sessionKey}`, windows.perSession],
    [`a_${addressKey ?? ''}`, addressKey ? windows.perAddress : undefined],
  ];
  return scoped.flatMap(([key, window]) => {
    if (!window) return [];
    const resetsAt = windowEnd(window, now);
    return [{ ref: db.doc(`rateLimits/${action}_${key}_${resetsAt.getTime()}`), window, resetsAt }];
  });
}

function tightest(states: LimitState[], now: Date): LimitState {
  const [first, ...rest] = states;
  if (!first) return { limit: 0, remaining: 0, resetsAt: now };
  return rest.reduce((best, state) => {
    if (state.remaining !== best.remaining) return state.remaining < best.remaining ? state : best;
    return state.resetsAt > best.resetsAt ? state : best;
  }, first);
}

/** Both windows pass or neither is spent, so a blocked call costs nothing. */
export async function consume(db: Firestore, action: LimitedAction, windows: ActionWindows, keys: Keys): Promise<LimitState & { allowed: boolean }> {
  const buckets = bucketsFor(db, action, windows, keys);
  return db.runTransaction(async (tx) => {
    const counts = await Promise.all(buckets.map(async ({ ref }) => ((await tx.get(ref)).data()?.count ?? 0) as number));
    const allowed = buckets.every(({ window }, i) => counts[i]! < window.max);
    if (allowed) {
      buckets.forEach(({ ref, resetsAt }, i) => tx.set(ref, { count: counts[i]! + 1, expiresAt: Timestamp.fromDate(resetsAt) }));
    }
    const spent = allowed ? 1 : 0;
    const states = buckets.map(({ window, resetsAt }, i) => ({ limit: window.max, remaining: Math.max(0, window.max - counts[i]! - spent), resetsAt }));
    return { allowed, ...tightest(states, keys.now) };
  });
}

export async function peek(db: Firestore, action: LimitedAction, windows: ActionWindows, keys: Keys): Promise<LimitState> {
  const states = await Promise.all(
    bucketsFor(db, action, windows, keys).map(async ({ ref, window, resetsAt }) => {
      const count = ((await ref.get()).data()?.count ?? 0) as number;
      return { limit: window.max, remaining: Math.max(0, window.max - count), resetsAt };
    }),
  );
  return tightest(states, keys.now);
}

/** All API calls: a safety net, so counted per instance, because a Firestore write per request costs too much. */
export function createApiCounter(windows: ActionWindows) {
  const counts = new Map<string, number>();
  return {
    hit(sessionKey: string, addressKey: string | undefined, now: Date): { retryAfterSeconds: number; resetsAt: Date } | null {
      const scoped: [string, Window | undefined][] = [
        [`s_${sessionKey}`, windows.perSession],
        [`a_${addressKey ?? ''}`, addressKey ? windows.perAddress : undefined],
      ];
      const entries = scoped.flatMap(([key, window]) => {
        if (!window) return [];
        const resetsAt = windowEnd(window, now);
        return [{ id: `${key}_${resetsAt.getTime()}`, window, resetsAt }];
      });
      const blocked = entries.find(({ id, window }) => (counts.get(id) ?? 0) >= window.max);
      if (blocked) return { resetsAt: blocked.resetsAt, retryAfterSeconds: Math.ceil((blocked.resetsAt.getTime() - now.getTime()) / 1000) };
      for (const { id } of entries) counts.set(id, (counts.get(id) ?? 0) + 1);
      if (counts.size > MAX_API_ENTRIES) counts.clear();
      return null;
    },
  };
}
