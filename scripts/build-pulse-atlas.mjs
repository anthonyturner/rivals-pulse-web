import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPulseAtlas, verifyPulseAtlas } from '../src/pulse-atlas.ts';

// The public API is the source because it needs no credentials and is the same
// contract the web app reads. Moving content to another database changes this
// reader only; the published files keep their shape.
const DEFAULT_API_BASE = 'https://marvel-rivals-coach-six.vercel.app/api';
const API_SOURCE_LABEL = 'rivals-pulse-web:content-api';
const MAPS_SOURCE_LABEL = 'rivals-pulse-web:seed-maps';
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 60_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(readFlag('--out') ?? join(repoRoot, 'dist', 'pulse-atlas-site'));
const apiBase = (process.env.PULSE_ATLAS_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, '');

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const inputs = [
  { dataset: 'heroes', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/heroes`) },
  { dataset: 'tier-list', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/tier-list`) },
  { dataset: 'glossary', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/glossary`) },
  {
    dataset: 'maps',
    source: MAPS_SOURCE_LABEL,
    data: JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'seed-maps.json'), 'utf8')),
  },
];

const files = buildPulseAtlas(inputs, new Date().toISOString(), sha256);

await rm(outDir, { recursive: true, force: true });
for (const file of files) {
  const target = join(outDir, file.path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, file.content, 'utf8');
}

const written = await Promise.all(
  files.map(async (file) => ({
    path: file.path,
    content: await readFile(join(outDir, file.path), 'utf8'),
  })),
);
verifyPulseAtlas(written, sha256);

for (const file of written) {
  console.log(`${file.path}  ${Buffer.byteLength(file.content)} bytes`);
}
console.log(`Pulse Atlas written to ${outDir}`);

async function fetchJson(url) {
  let lastError;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      console.warn(`Fetching ${url} failed (attempt ${attempt}/${FETCH_ATTEMPTS}): ${error}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2_000));
    }
  }

  throw new Error(`Could not fetch ${url}: ${lastError}`);
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
