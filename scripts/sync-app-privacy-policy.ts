// Keeps the checked-in copy of the desktop app's privacy policy in step with its source, the
// overlay repository's docs/privacy-policy.md.
//
//   npm run sync:app-privacy-policy    copy the file as of its newest commit and move the pin to it
//   npm run check:app-privacy-policy   fail when the pinned copy is behind the overlay repository
//
// The overlay repository is private, so both read it through the GitHub CLI: `gh` must be signed in
// with read access to it (in a workflow, set GH_TOKEN). `npm test` never needs the network: a spec
// holds the checked-in copy to the pin's hash and parses it.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { parsePolicyMarkdown } from '../src/app/features/privacy/app-privacy-policy/policy-markdown.ts';

const run = promisify(execFile);
const policyFolder = join(
  resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  'src',
  'app',
  'features',
  'privacy',
  'app-privacy-policy',
);
const COPY_FILE = join(policyFolder, 'app-privacy-policy.md');
const PIN_FILE = join(policyFolder, 'app-privacy-policy.source.json');

/** Where the copy came from and the hash of its text, so a hand edit or a stale copy shows. */
export interface PolicyPin {
  repository: string;
  path: string;
  commit: string;
  sha256: string;
}

/** Line endings are made LF so the hash is the same on every machine. */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function sha256Of(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function gh(...args: string[]): Promise<string> {
  const { stdout } = await run('gh', args, { maxBuffer: 8 * 1024 * 1024 });

  return stdout;
}

function isPin(value: unknown): value is PolicyPin {
  return (
    typeof value === 'object' &&
    value !== null &&
    'repository' in value &&
    typeof value.repository === 'string' &&
    'path' in value &&
    typeof value.path === 'string' &&
    'commit' in value &&
    typeof value.commit === 'string' &&
    'sha256' in value &&
    typeof value.sha256 === 'string'
  );
}

async function readPin(): Promise<PolicyPin> {
  const pin: unknown = JSON.parse(await readFile(PIN_FILE, 'utf8'));

  if (!isPin(pin)) {
    throw new Error(`${PIN_FILE} must hold the repository, path, commit and sha256 as strings.`);
  }

  return pin;
}

async function newestCommit(pin: PolicyPin): Promise<string> {
  const commit = (
    await gh('api', `repos/${pin.repository}/commits?path=${pin.path}&per_page=1`, '--jq', '.[0].sha')
  ).trim();

  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error(`Could not read the newest commit of ${pin.repository}/${pin.path}.`);
  }

  return commit;
}

async function fileAt(pin: PolicyPin, commit: string): Promise<string> {
  return normalizeLineEndings(
    await gh(
      'api',
      '-H',
      'Accept: application/vnd.github.raw+json',
      `repos/${pin.repository}/contents/${pin.path}?ref=${commit}`,
    ),
  );
}

/** Copies the newest source into the repository and moves the pin to its commit. */
export async function syncPolicy(): Promise<string> {
  const pin = await readPin();
  const commit = await newestCommit(pin);
  const text = await fileAt(pin, commit);

  // Throws on a missing date or Markdown the page cannot render, so a bad copy is never written.
  const policy = parsePolicyMarkdown(text);

  await writeFile(COPY_FILE, text);
  await writeFile(PIN_FILE, `${JSON.stringify({ ...pin, commit, sha256: sha256Of(text) }, null, 2)}\n`);

  return `Pinned ${pin.repository}@${commit.slice(0, 7)}, last updated ${policy.lastUpdated.text}.`;
}

/** Returns a description of the drift, or null when the copy is the source's newest. */
export async function findDrift(): Promise<string | null> {
  const pin = await readPin();
  const commit = await newestCommit(pin);
  const source = await fileAt(pin, commit);
  const copy = normalizeLineEndings(await readFile(COPY_FILE, 'utf8'));

  return source === copy
    ? null
    : `The copy is behind ${pin.repository}@${commit.slice(0, 7)} (pinned ${pin.commit.slice(0, 7)}). Run: npm run sync:app-privacy-policy`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const drift = await findDrift();

    if (drift !== null) {
      console.error(drift);
      process.exitCode = 1;
    } else {
      console.log('The app privacy policy copy matches its source.');
    }
  } else {
    console.log(await syncPolicy());
  }
}
