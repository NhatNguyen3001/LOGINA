import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
const script = read('tools/deploy-dev.sh');
const lineOf = (text: string) => script.split('\n').findIndex((line) => line.includes(text));
const LIMITS = [
  'LIMIT_NEW_SESSIONS_ADDRESS_HOUR',
  'LIMIT_API_SESSION_MINUTE',
  'LIMIT_API_ADDRESS_MINUTE',
];

describe('deploy-dev.sh', () => {
  it('deploys worker before api and passes WORKER_URL', () => {
    expect(lineOf('gcloud run deploy worker')).toBeGreaterThan(-1);
    expect(lineOf('gcloud run deploy worker')).toBeLessThan(lineOf('gcloud run deploy api'));
    expect(script).toContain('WORKER_URL=$WORKER_URL');
  });

  it('builds from the repo root', () => {
    expect(script).toMatch(/gcloud builds submit .*--config apps\/worker\/cloudbuild\.yaml .* \.$/m);
    expect(script).toMatch(/gcloud builds submit .*--config apps\/api\/cloudbuild\.yaml .* \.$/m);
  });

  it('stops on a dirty tree or a failed check', () => {
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('git status --porcelain');
    expect(script).toContain('pnpm check');
  });

  it('sets the runtime env vars', () => {
    for (const name of ['DEMO_MODE=true', 'DEMO_LOCALE=en', 'GCP_PROJECT_ID', 'TASKS_QUEUE=logina-jobs', 'TASKS_LOCATION', 'TASKS_INVOKER_SA', 'MATERIALS_BUCKET', 'VERTEX_LOCATION']) {
      expect(script).toContain(name);
    }
  });

  it('worker gets READER_MODEL and SEEDED_AI=false, api gets LIVE_UPLOADS_PER_DAY of 100', () => {
    expect(script).toContain('READER_MODEL=');
    expect(script).toContain('SEEDED_AI=false');
    expect(script).toContain('LIVE_UPLOADS_PER_DAY=100');
  });

  it('sets NO_SIGN_IN, RESEARCH_ENABLED, RESEARCH_SHEET_ID and PARTICIPANT_TYPE', () => {
    for (const name of ['NO_SIGN_IN=true', 'RESEARCH_ENABLED=true', 'RESEARCH_SHEET_ID', 'PARTICIPANT_TYPE=judge']) expect(script).toContain(name);
  });

  it('sets EXPORT_QUEUE and every LIMIT value', () => {
    expect(script).toContain('EXPORT_QUEUE=logina-export');
    for (const name of LIMITS) expect(script).toContain(`${name}=`);
  });

  it('reads RESEARCH_SHEET_ID from .env.deploy and omits it when empty', () => {
    expect(script).toContain('.env.deploy');
    expect(script).toMatch(/if \[ -n "\$\{RESEARCH_SHEET_ID:-\}" \]/);
  });

  it('deploys storage rules with hosting, Firestore rules and indexes', () => {
    expect(script).toContain('firebase deploy --only hosting,firestore:rules,firestore:indexes,storage');
  });
});

describe('what reaches Cloud Build and the images', () => {
  it('.gcloudignore keeps secrets and local notes out of the upload', () => {
    const ignored = read('.gcloudignore').split('\n');
    for (const entry of ['.git', '.claude/', '.superpowers/', '.codegraph/', '**/.env', '**/.env.*', 'node_modules/', 'AGENTS.md', 'CLAUDE.md']) {
      expect(ignored).toContain(entry);
    }
  });

  it('the domain package ships its fixtures and the worker ships its prompts', () => {
    expect(JSON.parse(read('packages/domain/package.json')).files).toContain('fixtures');
    expect(JSON.parse(read('apps/worker/package.json')).files).toContain('prompts');
  });

  it('.env.deploy has a tracked example and stays ignored', () => {
    expect(existsSync(fileURLToPath(new URL('../../.env.deploy.example', import.meta.url)))).toBe(true);
    expect(read('.gitignore')).toContain('**/.env.*');
  });
});
