import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { anonToken, liveSetup, type AnonSession, type LiveProject } from '@logina/test-utils';
import { createApp } from '../src/app.js';
import { noFiles } from './helpers.js';
import { testConfig } from '../src/config.js';
import type { AppEnv } from '../src/context.js';
import { ensureWorkspace, workspaceId } from '../src/services/workspace.js';

let live: LiveProject;
let a: AnonSession;
let b: AnonSession;
let app: Hono<AppEnv>;
let flagOff: Hono<AppEnv>;

const whoami = (router: Hono<AppEnv>, path: string, token: string) =>
  router.request(`/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });

const addProbes = (target: Hono<AppEnv>) => {
  for (const path of ['/demo/probe', '/me/assignments', '/me']) {
    target.get(`/api/v1${path}`, (c) => c.json(c.var.user));
  }
};

async function deleteWorkspace(uid: string): Promise<void> {
  const schoolId = workspaceId(uid);
  await live.db.doc(`schools/${schoolId}`).delete();
  await live.db.doc(`classes/${schoolId}_12a3`).delete();
  await live.db.doc(`users/tch_${uid}`).delete();
}

beforeAll(async () => {
  live = await liveSetup();
  [a, b] = await Promise.all([anonToken(), anonToken()]);
  const auth = getAuth(getApps().find((candidate) => candidate.name === 'logina-live-tests')!);
  const deps = { db: live.db, auth, enqueue: async () => {}, files: noFiles, now: () => new Date() };
  app = createApp({ ...deps, config: testConfig() });
  flagOff = createApp({ ...deps, config: testConfig({ noSignIn: false }) });
  addProbes(app);
  addProbes(flagOff);
});

afterAll(async () => {
  await Promise.all([deleteWorkspace(a.uid), deleteWorkspace(b.uid)]);
  await Promise.all([a.close(), b.close()]);
});

describe('anonymous sessions', () => {
  it('flag on: anonymous token reaches teacher and student routes', async () => {
    const teacher = await (await whoami(app, '/demo/probe', a.idToken)).json();
    const student = await (await whoami(app, '/me/assignments', a.idToken)).json();
    expect(teacher).toMatchObject({ uid: `tch_${a.uid}`, role: 'teacher', schoolId: `wks_${a.uid}` });
    expect(student).toMatchObject({ uid: a.uid, role: 'student', schoolId: `wks_${a.uid}` });
  });

  it('flag off: anonymous token is 401 on every route', async () => {
    for (const path of ['/demo/probe', '/me/assignments', '/me']) {
      expect((await whoami(flagOff, path, a.idToken)).status).toBe(401);
    }
  });

  it('/me and /me/consent use the session UID from either tab', async () => {
    const me = await (await whoami(app, '/me', a.idToken)).json();
    expect(me).toMatchObject({ uid: a.uid, role: 'demo' });
  });
});

describe('workspaces', () => {
  it('concurrent first requests create one workspace', async () => {
    const results = await Promise.all([
      ensureWorkspace(live.db, b.uid),
      ensureWorkspace(live.db, b.uid),
      ensureWorkspace(live.db, b.uid),
    ]);
    expect(new Set(results.map((r) => r.schoolId)).size).toBe(1);
    const classes = await live.db.collection('classes').where('schoolId', '==', workspaceId(b.uid)).get();
    expect(classes.size).toBe(1);
  });

  it('a new workspace is ready and has one class with its teacher', async () => {
    const { schoolId, teacherUid, classId } = await ensureWorkspace(live.db, a.uid);
    expect((await live.db.doc(`schools/${schoolId}`).get()).data()?.readyAt).toBeTruthy();
    expect((await live.db.doc(`classes/${classId}`).get()).data()).toMatchObject({ name: '12A3', teacherIds: [teacherUid] });
    expect((await live.db.doc(`users/${teacherUid}`).get()).data()).toMatchObject({ schoolId, role: 'teacher', isDemo: true });
  });

  it('a copy interrupted midway is resumed', async () => {
    const { schoolId } = await ensureWorkspace(live.db, a.uid);
    const stale = new Date(Date.now() - 60_000);
    await live.db.doc(`schools/${schoolId}`).update({ readyAt: null, copyStartedAt: stale });
    await ensureWorkspace(live.db, a.uid);
    expect((await live.db.doc(`schools/${schoolId}`).get()).data()?.readyAt).toBeTruthy();
  });

  it('a concurrent caller waits for readyAt', async () => {
    const { schoolId } = await ensureWorkspace(live.db, a.uid);
    await live.db.doc(`schools/${schoolId}`).update({ readyAt: null, copyStartedAt: new Date() });
    const waiting = ensureWorkspace(live.db, a.uid, { pollMs: 50 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await live.db.doc(`schools/${schoolId}`).update({ readyAt: new Date() });
    await expect(waiting).resolves.toMatchObject({ schoolId });
  });
});
