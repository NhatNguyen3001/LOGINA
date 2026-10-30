import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertReachable, liveConfig, liveSetup, testSchoolId, withReferer, type LiveProject } from '../src/live.js';

describe('liveConfig', () => {
  it('defaults to the test database and the test bucket', () => {
    expect(liveConfig({})).toEqual({
      projectId: 'logina-dev',
      databaseId: 'logina-test',
      bucket: 'logina-dev-test',
    });
  });

  it('takes the database and bucket from env', () => {
    const config = liveConfig({ FIRESTORE_DATABASE_ID: 'other-db', MATERIALS_BUCKET: 'other-bucket' });
    expect(config).toMatchObject({ databaseId: 'other-db', bucket: 'other-bucket' });
  });

  it('refuses the (default) database', () => {
    expect(() => liveConfig({ FIRESTORE_DATABASE_ID: '(default)' })).toThrow(/\(default\)/);
  });
});

describe('testSchoolId', () => {
  it('is unique and starts with test_', () => {
    const [a, b] = [testSchoolId(), testSchoolId()];
    expect(a).toMatch(/^test_[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});

describe('assertReachable', () => {
  it('fails with a clear message when the network is down', async () => {
    const offline = () => Promise.reject(new TypeError('fetch failed'));
    await expect(assertReachable(offline)).rejects.toThrow(/needs network access to Google Cloud/);
  });
});

describe('withReferer', () => {
  it('adds Referer to Identity Toolkit and Secure Token calls only', async () => {
    const seen: Array<[string, string | null]> = [];
    const stub = (input: string | URL | Request, init?: RequestInit) => {
      seen.push([String(input), new Headers(init?.headers).get('Referer')]);
      return Promise.resolve(new Response());
    };
    const wrapped = withReferer(stub, 'logina-dev');

    await wrapped('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=k', { headers: { A: 'b' } });
    await wrapped('https://securetoken.googleapis.com/v1/token?key=k');
    await wrapped('https://firestore.googleapis.com/v1/x');

    expect(seen).toEqual([
      ['https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=k', 'https://logina-dev.web.app/'],
      ['https://securetoken.googleapis.com/v1/token?key=k', 'https://logina-dev.web.app/'],
      ['https://firestore.googleapis.com/v1/x', null],
    ]);
  });
});

describe('liveSetup', () => {
  let live: LiveProject;
  const schoolId = testSchoolId();

  beforeAll(async () => {
    live = await liveSetup();
  });

  afterAll(async () => {
    await live?.db.doc(`schools/${schoolId}`).delete();
    await live?.bucket.file(`${schoolId}/note.txt`).delete({ ignoreNotFound: true });
  });

  it('reaches the logina-test database with Application Default Credentials', async () => {
    expect(live.db.databaseId).toBe('logina-test');
    const ref = live.db.doc(`schools/${schoolId}`);
    await ref.set({ purpose: 'live setup test' });
    expect((await ref.get()).data()).toEqual({ purpose: 'live setup test' });
  });

  it('reaches the logina-dev-test bucket with Application Default Credentials', async () => {
    expect(live.bucket.name).toBe('logina-dev-test');
    const file = live.bucket.file(`${schoolId}/note.txt`);
    await file.save('hello');
    expect((await file.download())[0].toString()).toBe('hello');
  });
});
