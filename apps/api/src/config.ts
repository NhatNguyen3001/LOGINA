import { defaultLimits, limitsFromEnv, type RateLimits } from './services/limits.js';

export interface Config {
  noSignIn: boolean;
  demoMode: boolean;
  projectId: string;
  databaseId: string;
  materialsBucket: string;
  liveUploadsPerDay: number;
  researchEnabled: boolean;
  participantType: string;
  /** The snapshot each new workspace starts from; unset leaves a workspace empty. */
  readySnapshot?: string;
  snapshotLocale: 'en' | 'vi';
  limits: RateLimits;
  /** How many X-Forwarded-For entries, from the right, our own proxies added. */
  trustedProxyHops: number;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  return {
    noSignIn: env.NO_SIGN_IN === 'true',
    demoMode: env.DEMO_MODE === 'true',
    projectId: env.GCP_PROJECT_ID ?? 'logina-dev',
    databaseId: env.FIRESTORE_DATABASE_ID || '(default)',
    materialsBucket: env.MATERIALS_BUCKET ?? 'logina-dev-materials',
    liveUploadsPerDay: Number(env.LIVE_UPLOADS_PER_DAY ?? 100),
    researchEnabled: env.RESEARCH_ENABLED !== 'false',
    participantType: env.PARTICIPANT_TYPE ?? 'judge',
    readySnapshot: env.READY_SNAPSHOT ?? `${env.DEMO_LOCALE ?? 'en'}_s01`,
    snapshotLocale: env.DEMO_LOCALE === 'vi' ? 'vi' : 'en',
    limits: limitsFromEnv(env),
    trustedProxyHops: Number(env.TRUSTED_PROXY_HOPS ?? 1),
  };
}

/** Suites share sessions across many calls; only rate-limit.test.ts tests the real values. */
const testLimits = Object.fromEntries(
  Object.keys(defaultLimits).map((action) => [action, { perSession: { max: 1_000_000, seconds: 3600 }, perAddress: { max: 1_000_000, seconds: 3600 } }]),
) as RateLimits;

export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  noSignIn: true,
  demoMode: true,
  projectId: 'logina-dev',
  databaseId: 'logina-test',
  materialsBucket: 'logina-dev-test',
  liveUploadsPerDay: 100,
  researchEnabled: true,
  participantType: 'judge',
  snapshotLocale: 'en',
  limits: testLimits,
  trustedProxyHops: 1,
  ...overrides,
});
