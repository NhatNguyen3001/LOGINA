import { findRestrictedKeys } from '@logina/contracts';

/** Throws, naming the JSON paths, if a response body carries a key its audience must not see. */
export function expectNoRestrictedKeys(json: unknown, audience: 'teacher' | 'student'): void {
  const paths = findRestrictedKeys(json, audience);
  if (paths.length > 0) throw new Error(`Restricted keys for ${audience}: ${paths.join(', ')}`);
}

const TYPE_WORDS = new Set(['string', 'number', 'boolean', 'object', 'map']);

/**
 * Field names marked with the lock emoji in 05-Backend-Schema. Only the data model is read: section 1 and
 * the restricted key list mention the emoji in prose.
 */
export function lockedFieldNames(schemaMarkdown: string): string[] {
  const start = schemaMarkdown.indexOf('## 2.');
  const end = schemaMarkdown.indexOf('**Restricted key list**');
  const dataModel = schemaMarkdown.slice(start, end === -1 ? undefined : end);

  const names = new Set<string>();
  for (const line of dataModel.split('\n')) {
    // | name | string 🔒 |
    const tableRow = /^\|\s*`?(\w+)`?\s*\|\s*\w+\s*🔒/.exec(line);
    if (tableRow?.[1]) names.add(tableRow[1]);

    // name: type 🔒
    for (const match of line.matchAll(/(\w+):\s*[\w[\]]+\s*🔒/g)) names.add(match[1]!);

    // name 🔒, `name` 🔒, name🔒, `name/{id}` 🔒
    for (const match of line.matchAll(/(\w+)(?:\/\{\w+\})?`?\s*🔒/gu)) {
      if (!TYPE_WORDS.has(match[1]!)) names.add(match[1]!);
    }
  }
  return [...names];
}
