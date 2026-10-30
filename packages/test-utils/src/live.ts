import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { deleteApp, initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const PROJECT_ID = 'logina-dev';
const ADMIN_APP = 'logina-live-tests';
const REFERER_HOSTS = ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'];

let refererInstalled = false;

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Bucket = ReturnType<ReturnType<typeof getAdminStorage>['bucket']>;

export interface LiveConfig {
  projectId: string;
  databaseId: string;
  bucket: string;
}

export interface LiveProject {
  config: LiveConfig;
  db: AdminFirestore;
  bucket: Bucket;
}

export interface AnonClient {
  uid: string;
  db: Firestore;
  storage: FirebaseStorage;
  /** Deletes the anonymous user and the client app. */
  close: () => Promise<void>;
}

export function liveConfig(env: Env = process.env): LiveConfig {
  const databaseId = env.FIRESTORE_DATABASE_ID ?? 'logina-test';
  if (databaseId === '(default)') {
    throw new Error('Tests must never touch the (default) database. Set FIRESTORE_DATABASE_ID to logina-test.');
  }
  return { projectId: PROJECT_ID, databaseId, bucket: env.MATERIALS_BUCKET ?? 'logina-dev-test' };
}

/** A unique tenant for one test file, so test files can run in parallel. */
export function testSchoolId(): string {
  return `test_${randomBytes(8).toString('hex')}`;
}

export async function assertReachable(fetchImpl: Fetch = fetch): Promise<void> {
  try {
    await fetchImpl('https://firestore.googleapis.com/', { method: 'HEAD', signal: AbortSignal.timeout(5_000) });
  } catch (cause) {
    throw new Error(
      `This test needs network access to Google Cloud: tests run live against ${PROJECT_ID}. ` +
        `Check your connection (${String(cause)}).`,
      { cause },
    );
  }
}

/** Admin access through Application Default Credentials. Call it in `beforeAll`. */
export async function liveSetup(env: Env = process.env): Promise<LiveProject> {
  const config = liveConfig(env);
  await assertReachable();
  const app =
    getApps().find((candidate) => candidate.name === ADMIN_APP) ??
    initializeAdminApp({ credential: applicationDefault(), projectId: config.projectId }, ADMIN_APP);
  return {
    config,
    db: getAdminFirestore(app, config.databaseId),
    bucket: getAdminStorage(app).bucket(config.bucket),
  };
}

function webApiKey(env: Env): string {
  if (env.FIREBASE_WEB_API_KEY) return env.FIREBASE_WEB_API_KEY;
  const path = fileURLToPath(new URL('../../../apps/web/.env.production', import.meta.url));
  const match = existsSync(path) ? /^VITE_FIREBASE_API_KEY=(.+)$/m.exec(readFileSync(path, 'utf8')) : null;
  if (!match?.[1]) {
    throw new Error(`No web API key: set FIREBASE_WEB_API_KEY or create ${path} (06-GCP-Setup-Checklist section 3).`);
  }
  return match[1].trim();
}

/** The web API key only accepts calls from its own sites, so Node has to say where it comes from. */
export function withReferer(fetchImpl: Fetch, projectId: string): Fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (!REFERER_HOSTS.includes(url.host)) return fetchImpl(input, init);
    const headers = new Headers(init?.headers);
    headers.set('Referer', `https://${projectId}.web.app/`);
    return fetchImpl(input, { ...init, headers });
  };
}

/**
 * A real browser-style client: Firebase client SDK, signed in anonymously through
 * Identity Toolkit `accounts:signUp`.
 */
export async function anonClient(config: LiveConfig, env: Env = process.env): Promise<AnonClient> {
  // firebase/auth keeps the global fetch it finds on first import, so the wrapper goes in first.
  if (!refererInstalled) {
    globalThis.fetch = withReferer(globalThis.fetch, config.projectId);
    refererInstalled = true;
  }
  const { getAuth, signInAnonymously } = await import('firebase/auth');

  const app = initializeApp({ apiKey: webApiKey(env), projectId: config.projectId }, randomUUID());
  try {
    const { user } = await signInAnonymously(getAuth(app));
    return {
      uid: user.uid,
      db: getFirestore(app, config.databaseId),
      storage: getStorage(app, `gs://${config.bucket}`),
      close: async () => {
        await user.delete();
        await deleteApp(app);
      },
    };
  } catch (cause) {
    await deleteApp(app);
    if ((cause as { code?: string }).code === 'auth/network-request-failed') {
      throw new Error(`Anonymous sign-in needs network access to Google Cloud (${PROJECT_ID}).`, { cause });
    }
    throw cause;
  }
}
