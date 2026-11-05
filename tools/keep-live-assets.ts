/**
 * Before a deploy replaces the site, copies the live version's code files into the new build, so a tab still running
 * that version can open screens it has not loaded yet. Only what the live start page reaches is kept: one version back.
 * Usage: tsx tools/keep-live-assets.ts --base https://logina-dev.web.app --into apps/web/dist
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXT = '(?:js|css|woff2?|svg|png|webp)';
const ABSOLUTE = new RegExp(String.raw`["'(\s=]/?(assets/[\w.-]+\.${EXT})(?=["')\s?#])`, 'g');
const RELATIVE = new RegExp(String.raw`["']\./([\w.-]+\.${EXT})["']`, 'g');

/** Every asset path an HTML or JS file points at, written as assets/<name>. */
export function assetRefs(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(ABSOLUTE)) found.add(match[1]!);
  for (const match of text.matchAll(RELATIVE)) found.add(`assets/${match[1]!}`);
  return [...found];
}

async function keepLiveAssets(base: string, into: string): Promise<number> {
  const start = await fetch(`${base}/`, { cache: 'no-store' });
  if (!start.ok) throw new Error(`The live start page answered ${start.status}.`);
  const queue = assetRefs(await start.text());
  const seen = new Set(queue);
  let kept = 0;
  while (queue.length > 0) {
    const path = queue.shift()!;
    const response = await fetch(`${base}/${path}`);
    const type = response.headers.get('content-type') ?? '';
    /** A file the live site no longer has comes back as the start page; that is not worth keeping. */
    if (!response.ok || type.includes('text/html')) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (path.endsWith('.js') || path.endsWith('.css')) {
      for (const next of assetRefs(bytes.toString('utf8'))) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    const target = join(into, path);
    if (existsSync(target)) continue;
    mkdirSync(join(into, 'assets'), { recursive: true });
    writeFileSync(target, bytes);
    kept += 1;
  }
  return kept;
}

const arg = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = arg('--base');
  const into = arg('--into');
  if (!base || !into) {
    console.error('Usage: tsx tools/keep-live-assets.ts --base <url> --into <dist>');
    process.exit(1);
  }
  /** A first deploy, or a site that cannot be reached, must not stop the deploy. */
  keepLiveAssets(base, into).then(
    (kept) => console.log(`Kept ${kept} code files from the live version.`),
    (error: unknown) => console.warn(`Could not keep the live version's code files: ${error instanceof Error ? error.message : String(error)}`),
  );
}
