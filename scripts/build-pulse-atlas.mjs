import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assembleCommunityHeroStats,
  assembleCommunityTierList,
  buildPulseAtlas,
  communityHalfSeasonRequests,
  PULSE_ATLAS_BASE_PATH,
  PULSE_ATLAS_DATASETS,
  PULSE_ATLAS_HERO_GAME_IDS,
  PULSE_ATLAS_MANIFEST_PATH,
  PULSE_ATLAS_OPTIONAL_DATASETS,
  parseManifest,
  resolveCommunityStats,
  resolveHeroScores,
  resolveHeroSpecialists,
  resolveTeamLineups,
  tierListSeasonPath,
  verifyPulseAtlas,
} from '../src/server/pulse-atlas/pulse-atlas.ts';
import { renderPulseAtlasPage } from '../src/server/pulse-atlas/pulse-atlas-page.ts';

// The public API is the source because it needs no credentials and is the same
// contract the web app reads. Moving content to another database changes this
// reader only; the published files keep their shape.
const DEFAULT_API_BASE = 'https://marvel-rivals-coach-six.vercel.app/api';
const DEFAULT_PUBLISHED_BASE = 'https://anthonyturner.github.io/rivals-pulse-web';
const API_SOURCE_LABEL = 'rivals-pulse-web:content-api';
const HERO_STATS_SOURCE_LABEL = 'rivals-pulse-web:hero-stats-api';
const MAPS_SOURCE_LABEL = 'rivals-pulse-web:seed-maps';
const HERO_STYLES_SOURCE_LABEL = 'rivals-pulse-web:seed-hero-styles';
const HERO_GAME_IDS_SOURCE_LABEL = 'rivals-pulse-web:seed-hero-game-ids';
const STRATEGIST_TAGS_SOURCE_LABEL = 'rivals-pulse-web:seed-strategist-tags';
const SAMPLE_SOURCE_LABEL = 'SAMPLE: trimmed, not live data';
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 60_000;
const PUBLISHED_TIMEOUT_MS = 15_000;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const samplesDir = readFlag('--samples');
const outDir = resolve(readFlag('--out') ?? join(repoRoot, 'dist', 'pulse-atlas-site'));
const apiBase = trimSlashes(process.env.PULSE_ATLAS_API_BASE ?? DEFAULT_API_BASE);
const publishedBase = trimSlashes(process.env.PULSE_ATLAS_PUBLISHED_BASE ?? DEFAULT_PUBLISHED_BASE);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// On GitHub Actions a `::warning::` line becomes an annotation on the run, so a hero
// left out of the feed is visible without opening the log.
const warn = (message) => console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `Warning: ${message}`);

const heroGameIds = JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'hero-game-ids.json'), 'utf8'));

// One /api/hero-stats read feeds both community datasets, so they describe the same moment.
const heroStatsAnswers = await fetchHeroStatsAnswers();

const live = [
  { dataset: 'heroes', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/heroes`) },
  {
    dataset: 'tier-list',
    source: HERO_STATS_SOURCE_LABEL,
    data: assembleCommunityTierList(heroStatsAnswers.current, heroStatsAnswers.exact, heroGameIds, warn),
  },
  { dataset: 'glossary', source: API_SOURCE_LABEL, data: await fetchJson(`${apiBase}/glossary`) },
  {
    dataset: 'maps',
    source: MAPS_SOURCE_LABEL,
    data: JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'seed-maps.json'), 'utf8')),
  },
  {
    dataset: 'hero-styles',
    source: HERO_STYLES_SOURCE_LABEL,
    data: JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'hero-styles.json'), 'utf8')),
  },
  {
    dataset: 'strategist-tags',
    source: STRATEGIST_TAGS_SOURCE_LABEL,
    data: JSON.parse(await readFile(join(repoRoot, 'data', 'pulse-atlas', 'strategist-tags.json'), 'utf8')),
  },
  {
    dataset: 'hero-stats',
    source: HERO_STATS_SOURCE_LABEL,
    data: assembleCommunityHeroStats(heroStatsAnswers.current, heroStatsAnswers.exact, heroGameIds, warn),
  },
  {
    // Merged into heroes.json as each hero's gameId; not a published file of its own.
    dataset: PULSE_ATLAS_HERO_GAME_IDS,
    source: HERO_GAME_IDS_SOURCE_LABEL,
    data: heroGameIds,
  },
];

const published = samplesDir ? [] : await fetchPublished();

// Never holds up the publish: if the endpoint or its database function is not deployed yet, or
// fails, the last published file stays (or the dataset is left out if none ever was), with a warning.
const communityStats = await resolveCommunityStats({
  read: () => fetchJson(`${apiBase}/hero-pairs`),
  published,
  source: HERO_STATS_SOURCE_LABEL,
  warn,
});

if (communityStats) {
  live.push(communityStats);
}

// The same promise: the scores never hold up the publish either.
const heroScores = await resolveHeroScores({
  read: () => fetchJson(`${apiBase}/community/hero-scores`),
  published,
  source: HERO_STATS_SOURCE_LABEL,
  warn,
  heroGameIds,
});

if (heroScores) {
  live.push(heroScores);
}

// The same promise again. The API answers in Competitive when it is asked for no mode, and the
// file records that mode, so a reader never has to guess it.
const teamLineups = await resolveTeamLineups({
  read: () => fetchJson(`${apiBase}/team-lineups`),
  published,
  source: HERO_STATS_SOURCE_LABEL,
  warn,
});

if (teamLineups) {
  live.push(teamLineups);
}

// The same promise once more: the API and the database function behind it ship apart from this
// repository, so a run can come first and must not hold up the rest.
const heroSpecialists = await resolveHeroSpecialists({
  read: () => fetchJson(`${apiBase}/hero-specialists`),
  published,
  source: HERO_STATS_SOURCE_LABEL,
  warn,
  heroGameIds,
});

if (heroSpecialists) {
  live.push(heroSpecialists);
}

const now = new Date().toISOString();
// A sample keeps two heroes, so most of its tier-list heroes would warn; its warnings are dropped.
const files = samplesDir
  ? buildPulseAtlas(live.map(sampler(live)), now, sha256, [], () => undefined)
  : buildPulseAtlas(live, now, sha256, published, warn);

// Samples sit in one folder without the version prefix (`tier-list/seasons/21.json`
// stays under its own folder); the live feed keeps its versioned folders.
const targetOf = (file) =>
  samplesDir
    ? join(resolve(samplesDir), file.path.slice(PULSE_ATLAS_BASE_PATH.length + 1))
    : join(outDir, file.path);

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

// The home pages are rendered from the verified manifest as written; they add
// files next to the feed and never change the dataset files or the manifest.
if (!samplesDir) {
  const manifest = parseManifest(written.find((file) => file.path === PULSE_ATLAS_MANIFEST_PATH).content);

  for (const pagePath of ['index.html', `${PULSE_ATLAS_BASE_PATH}/index.html`]) {
    const html = renderPulseAtlasPage(manifest, { pagePath, manifestPath: PULSE_ATLAS_MANIFEST_PATH });
    await mkdir(dirname(join(outDir, pagePath)), { recursive: true });
    await writeFile(join(outDir, pagePath), html, 'utf8');
    console.log(`${pagePath}  ${Buffer.byteLength(html)} bytes`);
  }
}

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

// The community datasets are built from the site's own hero stats, never from another site. The
// default answer is the current half-season and lists every half-season that has started; one more
// request per half-season, the current one included, collects its own exact numbers, so nothing
// here names a season.
async function fetchHeroStatsAnswers() {
  const current = await fetchJson(`${apiBase}/hero-stats`);
  const exact = [];

  for (const halfSeason of communityHalfSeasonRequests(current)) {
    exact.push({ halfSeason, response: await fetchJson(`${apiBase}/hero-stats?halfSeason=${halfSeason}`) });
  }

  return { current, exact };
}

// What is published right now, so unchanged datasets and tier-list seasons keep
// their exact bytes. A failure here (the first run gets a 404) only costs a
// fresh build of that file.
async function fetchPublished() {
  const seasonIds = live.find((input) => input.dataset === 'tier-list').data.seasons.map((season) => season.id);
  const paths = [
    ...PULSE_ATLAS_DATASETS.map((name) => `${PULSE_ATLAS_BASE_PATH}/${name}.json`),
    ...seasonIds.map(tierListSeasonPath),
  ];
  const results = await Promise.all(
    paths.map(async (path) => {
      // An optional dataset's file is one the run cannot rebuild if the read fails, so it is tried
      // again unless the answer is a plain 404 (never published).
      const optional = PULSE_ATLAS_OPTIONAL_DATASETS.some((name) => path === `${PULSE_ATLAS_BASE_PATH}/${name}.json`);
      const attempts = optional ? FETCH_ATTEMPTS : 1;
      let lastError;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const response = await fetch(`${publishedBase}/${path}`, {
            signal: AbortSignal.timeout(PUBLISHED_TIMEOUT_MS),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return { path, content: await response.text() };
        } catch (error) {
          lastError = error;

          if (String(error).includes('HTTP 404')) {
            break;
          }
        }
      }

      console.warn(`No published ${path} to compare with (${lastError}); building it fresh.`);
      return undefined;
    }),
  );

  return results.filter((file) => file !== undefined);
}

// The sample keeps two heroes, so hero-styles keeps those two heroes' entries to stay complete.
function sampler(live) {
  const sampleHeroIds = live
    .find((input) => input.dataset === 'heroes')
    .data.slice(0, 2)
    .map((hero) => hero.id);

  return (input) => toSample(input, sampleHeroIds);
}

function toSample(input, sampleHeroIds) {
  const sampleOf = (data) => {
    switch (input.dataset) {
      case 'heroes':
        return data.slice(0, 2);
      case 'hero-styles':
      case 'strategist-tags':
        return data.filter((entry) => sampleHeroIds.includes(entry.heroId));
      case 'glossary':
        return data.slice(0, 3);
      case 'hero-stats':
        // The same two seasons as the tier list, with two heroes each.
        return trimHeroStats(data);
      case 'community-stats':
        return trimCommunityStats(data);
      case 'hero-scores':
        return { ...data, heroes: data.heroes.slice(0, 2) };
      case 'team-lineups':
        return trimTeamLineups(data);
      case 'hero-specialists':
        return trimHeroSpecialists(data);
      case 'tier-list': {
        // The current season and the one before it, so the sample shows the index
        // entry with ranks next to one without.
        const current = data.seasons.findIndex((season) => season.id === data.currentSeasonId);
        const trimSnapshot = (snapshot) => ({
          ...snapshot,
          tiers: snapshot.tiers
            .filter((tier) => tier.heroes.length > 0)
            .map((tier) => ({ ...tier, heroes: tier.heroes.slice(0, 2) })),
          ...(snapshot.belowMinimum ? { belowMinimum: snapshot.belowMinimum.slice(0, 2) } : {}),
        });

        return {
          ...data,
          seasons: data.seasons.slice(Math.max(0, current - 1), current + 1).map((season) => ({
            ...season,
            ranks: Object.fromEntries(
              Object.entries(season.ranks).map(([rank, snapshot]) => [rank, trimSnapshot(snapshot)]),
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

// One cell with enough data and one without, so the sample shows both.
function sampleCells(cells) {
  return [cells.find((cell) => cell.enoughData), cells.find((cell) => !cell.enoughData)]
    .filter((cell) => cell !== undefined)
    .sort((a, b) => a.heroId - b.heroId);
}

function trimHeroStats(data) {
  const current = data.seasons.findIndex((season) => season.id === data.currentSeasonId);

  return {
    ...data,
    seasons: data.seasons.slice(Math.max(0, current - 1), current + 1).map((season) => ({
      ...season,
      heroes: sampleCells(season.heroes),
    })),
  };
}

// Two heroes and two pairs of each kind per band, so the sample shows the shape without the volume.
function trimCommunityStats(data) {
  const firstTwo = (rows) => rows.slice(0, 2);

  return {
    ...data,
    bands: data.bands.map((band) => ({
      ...band,
      heroes: firstTwo(band.heroes),
      counters: firstTwo(band.counters),
      synergies: firstTwo(band.synergies),
    })),
  };
}

// One shape with enough data and one without, so the sample shows both.
function trimTeamLineups(data) {
  return {
    ...data,
    shapes: [
      data.shapes.find((shape) => shape.status === 'ready'),
      data.shapes.find((shape) => shape.status !== 'ready'),
    ].filter((shape) => shape !== undefined),
  };
}

// One hero with both buckets and one without, so the sample shows both.
function trimHeroSpecialists(data) {
  return {
    ...data,
    heroes: [
      data.heroes.find((hero) => hero.status === 'ready'),
      data.heroes.find((hero) => hero.status !== 'ready'),
    ].filter((hero) => hero !== undefined),
  };
}

function trimSlashes(url) {
  return url.replace(/\/+$/, '');
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
