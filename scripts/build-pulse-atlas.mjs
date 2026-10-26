import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assembleTierList,
  buildPulseAtlas,
  PULSE_ATLAS_BASE_PATH,
  PULSE_ATLAS_DATASETS,
  tierListRequests,
  verifyPulseAtlas,
} from '../src/pulse-atlas.ts';

// The public API is the source because it needs no credentials and is the same
// contract the web app reads. Moving content to another database changes this
// reader only; the published files keep their shape.
const DEFAULT_API_BASE = 'https://marvel-rivals-coach-six.vercel.app/api';
const DEFAULT_PUBLISHED_BASE = 'https://anthonyturner.github.io/rivals-pulse-web';
const API_SOURCE_LABEL = 'rivals-pulse-web:content-api';
const MAPS_SOURCE_LABEL = 'rivals-pulse-web:seed-maps';
const SAMPLE_SOURCE_LABEL = 'SAMPLE: trimmed, not live data';
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 60_000;
const TIER_LIST_CONCURRENCY = 6;
const PUBLISHED_TIMEOUT_MS = 15_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const samplesDir = readFlag('--samples');
const outDir = resolve(readFlag('--out') ?? join(repoRoot, 'dist', 'pulse-atlas-site'));
const apiBase = trimSlashes(process.env.PULSE_ATLAS_API_BASE ?? DEFAULT_API_BASE);
const publishedBase = trimSlashes(process.env.PULSE_ATLAS_PUBLISHED_BASE ?? DEFAULT_PUBLISHED_BASE);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const live = [
  { dataset: 'heroes', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/heroes`) },
  { dataset: 'tier-list', source: API_SOURCE_LABEL, data: await fetchTierList() },
  { dataset: 'glossary', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/glossary`) },
  {
    dataset: 'maps',
    source: MAPS_SOURCE_LABEL,
    data: JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'seed-maps.json'), 'utf8')),
  },
];

const now = new Date().toISOString();
const files = samplesDir
  ? buildPulseAtlas(live.map(toSample), now, sha256)
  : buildPulseAtlas(live, now, sha256, await fetchPublished());

// Samples sit flat in one folder; the live feed keeps its versioned folders.
const targetOf = (file) =>
  samplesDir ? join(resolve(samplesDir), basename(file.path)) : join(outDir, file.path);

if (!samplesDir) {
  // Only the versioned feed folder is ours to clear, wherever --out points.
  await rm(join(outDir, PULSE_ATLAS_BASE_PATH), { recursive: true, force: true });
}
for (const file of files) {
  await mkdir(dirname(targetOf(file)), { recursive: true });
  await writeFile(targetOf(file), file.content, 'utf8');
}

const written = await Promise.all(
  files.map(async (file) => ({ path: file.path, content: await readFile(targetOf(file), 'utf8') })),
);
verifyPulseAtlas(written, sha256);

for (const file of written) {
  console.log(`${file.path}  ${Buffer.byteLength(file.content)} bytes`);
}
console.log(`Pulse Atlas written to ${samplesDir ? resolve(samplesDir) : outDir}`);

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

      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2_000));
      }
    }
  }

  throw new Error(`Could not fetch ${url}: ${lastError}`);
}

// The default response lists every season and rank; one request per pair then
// collects each snapshot, so nothing here names a season or a rank.
async function fetchTierList() {
  const index = await fetchJson(`${apiBase}/tier-list`);
  const requests = tierListRequests(index);
  const snapshots = [];
  let next = 0;

  const worker = async () => {
    while (next < requests.length) {
      const { seasonId, rank } = requests[next++];
      const query = `season=${seasonId}&rank=${encodeURIComponent(rank)}`;
      snapshots.push({ seasonId, rank, response: await fetchJson(`${apiBase}/tier-list?${query}`) });
    }
  };
  await Promise.all(Array.from({ length: TIER_LIST_CONCURRENCY }, worker));

  return assembleTierList(index, snapshots);
}

// What is published right now, so unchanged datasets keep their exact bytes.
// A failure here (the first run gets a 404) only costs a fresh build.
async function fetchPublished() {
  const results = await Promise.all(
    PULSE_ATLAS_DATASETS.map(async (name) => {
      const path = `${PULSE_ATLAS_BASE_PATH}/${name}.json`;

      try {
        const response = await fetch(`${publishedBase}/${path}`, {
          signal: AbortSignal.timeout(PUBLISHED_TIMEOUT_MS),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return { path, content: await response.text() };
      } catch (error) {
        console.warn(`No published ${name} to compare with (${error}); building it fresh.`);
        return undefined;
      }
    }),
  );

  return results.filter((file) => file !== undefined);
}

function toSample(input) {
  const sampleOf = (data) => {
    switch (input.dataset) {
      case 'heroes':
        return data.slice(0, 2);
      case 'glossary':
        return data.slice(0, 3);
      case 'tier-list': {
        const ranks = data.rankFilters.slice(0, 2).map((filter) => filter.value);
        const trimTiers = (tiers) =>
          tiers.filter((tier) => tier.heroes.length > 0).map((tier) => ({ ...tier, heroes: tier.heroes.slice(0, 2) }));

        return {
          ...data,
          rankFilters: data.rankFilters.slice(0, 2),
          seasons: data.seasons.slice(-2).map((season) => ({
            ...season,
            ranks: Object.fromEntries(
              ranks.map((rank) => [rank, { tiers: trimTiers(season.ranks[rank].tiers) }]),
            ),
          })),
        };
      }
      default:
        return data;
    }
  };

  return { ...input, source: SAMPLE_SOURCE_LABEL, data: sampleOf(input.data) };
}

function trimSlashes(url) {
  return url.replace(/\/+$/, '');
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
