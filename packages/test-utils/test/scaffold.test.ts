import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const repoJson = (path: string) => JSON.parse(readFileSync(`${repoRoot}${path}`, 'utf8'));

describe('firebase.json', () => {
  it('has no emulators block and points at the rules files', () => {
    const config = repoJson('firebase.json');
    expect(config.emulators).toBeUndefined();
    expect(config.storage).toEqual({ rules: 'storage.rules' });
    expect(config.firestore.map((entry: { database: string }) => entry.database)).toEqual(['(default)', 'logina-test']);
  });
});

describe('no-restricted-imports in apps/web', () => {
  const lint = async (filePath: string, code: string) => {
    const [result] = await new ESLint({ cwd: repoRoot }).lintText(code, { filePath });
    return result!.messages.map((message) => message.ruleId);
  };

  it.each([
    'firebase/firestore',
    'firebase/storage',
    'firebase-admin',
    'firebase-admin/firestore',
    '@google-cloud/storage',
  ])('bans %s in apps/web', async (name) => {
    expect(await lint('apps/web/src/x.ts', `import '${name}';\n`)).toContain('no-restricted-imports');
  });

  it('allows firebase/auth in apps/web and firebase-admin in apps/api', async () => {
    expect(await lint('apps/web/src/x.ts', `import 'firebase/auth';\n`)).toEqual([]);
    expect(await lint('apps/api/src/x.ts', `import 'firebase-admin';\n`)).toEqual([]);
  });
});
