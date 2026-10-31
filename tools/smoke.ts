import { parseArgs } from 'node:util';
import { findRestrictedKeys } from '@logina/contracts';

/** Checks a deployed site as two fresh browsers. Prints no tokens. Run: pnpm smoke --base <url> */
const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';

const { values } = parseArgs({ options: { base: { type: 'string' } } });
const base = values.base;
const key = process.env.FIREBASE_WEB_API_KEY;
if (!base || !key) throw new Error('Pass --base and set FIREBASE_WEB_API_KEY.');

function check(condition: unknown, what: string): void {
  if (!condition) throw new Error(`Smoke failed: ${what}`);
  console.log(`ok  ${what}`);
}

async function signUp(): Promise<string> {
  const response = await fetch(`${IDENTITY}:signUp?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: `${base}/` },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Anonymous sign-up failed: HTTP ${response.status}`);
  return ((await response.json()) as { idToken: string }).idToken;
}

const request = (token: string, path: string, method = 'GET') =>
  fetch(`${base}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });

const health = await fetch(`${base}/api/v1/health`);
check(health.status === 200, 'health is 200');
check(health.headers.get('cache-control')?.includes('no-store'), 'health is not cached');

const [first, second] = await Promise.all([signUp(), signUp()]);

const lessons = (await (await request(first, '/lessons')).json()) as { lessons: { id: string }[] };
check(lessons.lessons.length > 0, 'a new session gets a workspace with the ready lesson');

const assignments = (await (await request(first, '/me/assignments')).json()) as { assignments: { assignmentId: string }[] };
const assignment = assignments.assignments[0];
check(assignment, 'the ready assignment opens');

const attempt = (await (await request(first, `/assignments/${assignment!.assignmentId}/attempts`, 'POST')).json()) as { attemptId: string };
const task = await (await request(first, `/attempts/${attempt.attemptId}/tasks/Q1`)).json();
check(findRestrictedKeys(task, 'student').length === 0, 'a student task carries no restricted keys');

check((await request(second, `/lessons/${lessons.lessons[0]!.id}`)).status === 404, 'a second session cannot see the first session lesson');
console.log('Smoke passed.');
