import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RESTRICTED_KEYS, findRestrictedKeys, type dtoSchemas } from '@logina/contracts';
import { exampleVariants, examples, examplesVi } from '@logina/contracts/examples';
import { describe, expect, it } from 'vitest';
import { expectNoRestrictedKeys, lockedFieldNames } from '../src/scan.js';

const SCHEMA_DOC = fileURLToPath(new URL('../../../.claude/docs/05-Backend-Schema.md', import.meta.url));

/** 05-Backend-Schema section 9, Role column. "Any session" reaches students, so it gets the stricter scan. */
const STUDENT_VISIBLE: (keyof typeof dtoSchemas)[] = [
  'assignmentList',
  'attempt',
  'studentTask',
  'studentChallenge',
  'submitResult',
  'studentFeedback',
  'me',
  'consentResult',
  'limits',
  'rateLimit',
  'error',
];
const audienceOf = (name: string) =>
  (STUDENT_VISIBLE as string[]).includes(name) ? ('student' as const) : ('teacher' as const);

describe('findRestrictedKeys', () => {
  it('flags trigger and prompt keys for any audience', () => {
    const json = { a: { trigger: {} }, prompt: 'x' };
    expect(findRestrictedKeys(json, 'teacher')).toEqual(['$.a.trigger', '$.prompt']);
    expect(findRestrictedKeys(json, 'student')).toEqual(['$.a.trigger', '$.prompt']);
  });

  it('flags answerCorrectness only for students', () => {
    expect(findRestrictedKeys({ answerCorrectness: 'X' }, 'teacher')).toEqual([]);
    expect(findRestrictedKeys({ answerCorrectness: 'X' }, 'student')).toEqual(['$.answerCorrectness']);
  });

  it('scan finds restricted key nested in arrays', () => {
    expect(findRestrictedKeys({ items: [{ x: { pairAlignment: 'C' } }] }, 'student')).toEqual([
      '$.items[0].x.pairAlignment',
    ]);
  });

  it('flags an exact error key but not errorCount', () => {
    expect(findRestrictedKeys({ error: {}, errorCount: 1 }, 'teacher')).toEqual(['$.error']);
  });

  it('does not flag errorCode, readBy or aiMode', () => {
    expect(findRestrictedKeys({ errorCode: 'X', readBy: 'AI', aiMode: 'LIVE' }, 'teacher')).toEqual([]);
    expect(findRestrictedKeys({ storagePath: 'x', error: {} }, 'teacher')).toEqual(['$.storagePath', '$.error']);
  });

  it('handles primitives and null', () => {
    expect(findRestrictedKeys(null, 'student')).toEqual([]);
    expect(findRestrictedKeys('prompt', 'student')).toEqual([]);
  });
});

describe('examples and the scan', () => {
  it('every example passes the scan for its audience', () => {
    for (const [name, payload] of [...Object.entries(examples), ...Object.entries(examplesVi)]) {
      expect(findRestrictedKeys(payload, audienceOf(name)), name).toEqual([]);
    }
    for (const [name, variants] of Object.entries(exampleVariants)) {
      expect(findRestrictedKeys(variants, audienceOf(name)), name).toEqual([]);
    }
  });

  it('expectNoRestrictedKeys names the paths it found', () => {
    expect(() => expectNoRestrictedKeys({ answerIdMap: {} }, 'teacher')).toThrow('$.answerIdMap');
    expect(() => expectNoRestrictedKeys({ id: 'x' }, 'student')).not.toThrow();
  });
});

describe('lockedFieldNames', () => {
  it('reads every pattern the schema doc uses', () => {
    const doc = [
      '## 2. Collection map',
      'ruleBundles/{ruleBundleId}      🔒 entire collection server-only',
      '| storagePath | string 🔒 | path |',
      '| dependencyManifest 🔒 | object | x |',
      '| trigger 🔒, contextGuard 🔒 | | x |',
      '| figure | `{ blobPath 🔒, altText: string }?` | x |',
      '`{ acceptedOrders: string[][] 🔒 }`',
      '`{ status, error🔒: { code } }`',
      '### `lockedThing/{id}` 🔒 (section)',
    ].join('\n');
    expect(lockedFieldNames(doc).sort()).toEqual([
      'acceptedOrders',
      'blobPath',
      'contextGuard',
      'dependencyManifest',
      'error',
      'lockedThing',
      'ruleBundles',
      'storagePath',
      'trigger',
    ]);
  });

  it('ignores prose outside the data model sections', () => {
    const doc = [
      '## 1. Ground rules',
      'fields are marked 🔒 below.',
      '## 2. Collection map',
      '| x 🔒 | string | |',
      '**Restricted key list**',
      'patterns `name` 🔒, `name: type 🔒`',
    ].join('\n');
    expect(lockedFieldNames(doc)).toEqual(['x']);
  });

  it('every 🔒 field in 05-Backend-Schema is in RESTRICTED_KEYS', (context) => {
    if (!existsSync(SCHEMA_DOC)) {
      context.skip(`${SCHEMA_DOC} is missing: .claude/ is gitignored, so a fresh clone has no docs to check against`);
    }
    const names = lockedFieldNames(readFileSync(SCHEMA_DOC, 'utf8'));
    expect(names).not.toEqual([]);

    const patterns = [...RESTRICTED_KEYS.all, ...RESTRICTED_KEYS.student];
    expect(names.filter((name) => !patterns.some((pattern) => pattern.test(name)))).toEqual([]);
  });
});
