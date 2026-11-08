import { COMMUNITY_BUCKET_MIN_PLAYERS } from '../community/community-minimums.ts';
import { TEAM_LINEUP_MIN_TEAMS } from '../heroes/lineups/team-lineups.ts';
import { findStrategistTagProblems } from './strategist-tags.ts';

const PULSE_ATLAS_SCHEMA_VERSION = 1;
export const PULSE_ATLAS_BASE_PATH = 'pulse-atlas/v1';
export const PULSE_ATLAS_DATASETS = [
  'heroes',
  'tier-list',
  'glossary',
  'maps',
  'hero-styles',
  'strategist-tags',
  'hero-stats',
  'community-stats',
  'hero-scores',
  'team-lineups',
] as const;

/**
 * Datasets a run may leave out: the feed is valid without them, in the manifest and on disk alike.
 * These depend on an endpoint and a database function that are deployed separately, so the publish
 * must not be held up by them (see `resolveOptionalDataset`).
 */
export const PULSE_ATLAS_OPTIONAL_DATASETS: readonly PulseAtlasDataset[] = ['community-stats', 'hero-scores', 'team-lineups'];

/**
 * Read to build `heroes.json` (each hero's numeric `gameId`) but not published as a file of its own,
 * so it is not in `PULSE_ATLAS_DATASETS` and not in the manifest.
 */
export const PULSE_ATLAS_HERO_GAME_IDS = 'hero-game-ids';

const HERO_STYLE_WEIGHTS = ['poke', 'dive', 'brawl'] as const;
const HERO_ROLES = ['Vanguard', 'Duelist', 'Strategist'] as const;
const GAME_ID_ENTRY_KEYS: readonly string[] = ['id', 'gameId', 'gameIdVariants'];

type PulseAtlasDataset = (typeof PULSE_ATLAS_DATASETS)[number];

type Sha256Hex = (text: string) => string;

export interface PulseAtlasInput {
  dataset: PulseAtlasDataset | typeof PULSE_ATLAS_HERO_GAME_IDS;
  /** Provenance label. Its value may change when the content source moves; the file shape never does. */
  source: string;
  data: unknown;
}

interface PulseAtlasEnvelope {
  schemaVersion: number;
  /** When this dataset's data last changed, not when the feed last ran. */
  generatedAt: string;
  source: string;
  data: unknown;
}

interface PulseAtlasManifestEntry {
  dataset: PulseAtlasDataset;
  path: string;
  sha256: string;
  bytes: number;
}

export interface PulseAtlasManifest {
  schemaVersion: number;
  /** The latest `generatedAt` among the dataset files. */
  generatedAt: string;
  files: PulseAtlasManifestEntry[];
}

export interface PulseAtlasFile {
  /** Path relative to the Pages site root, e.g. `pulse-atlas/v1/heroes.json`. */
  path: string;
  content: string;
}

export const PULSE_ATLAS_MANIFEST_PATH = `${PULSE_ATLAS_BASE_PATH}/manifest.json`;

/**
 * Where one season of the tier list is published. The overlay builds this URL
 * from the season id, so the `path` in the tier-list index must be exactly this.
 */
export function tierListSeasonPath(seasonId: number): string {
  return `${PULSE_ATLAS_BASE_PATH}/tier-list/seasons/${seasonId}.json`;
}

// Reference data never needs these words in a key, so a hit is treated as a
// leak of something private rather than as a false alarm.
const PRIVATE_KEY =
  /secret|password|passwd|token|api[-_]?key|authorization|credential|email|puuid|player|steam|account|session/i;

// A number of players, never who they are: the one key the player pattern lets through, so a file can
// say how many players a figure waits for. Its value is checked where the key is allow-listed.
const PLAYER_COUNT_KEYS: readonly string[] = ['minimumPlayers'];

// `counters` are matchup picks derived from a third-party site and are never published, so the key
// is unsafe everywhere except in community-stats, whose counters are the site's own counts.
const UNSAFE_KEY = new RegExp(`${PRIVATE_KEY.source}|^counters?$`, 'i');

// Credential shapes, plus the third-party sources the feed must never name or
// link: the scraped counter source, and Rivals Meta (the overlay ships these
// files inside its package).
const UNSAFE_VALUE =
  /sb_secret_|libsql:\/\/|Bearer\s+\S|-----BEGIN|eyJ[\w-]{10,}\.[\w-]{10,}\.|counter\s*-?\s*watch|rivalsmeta/i;

// Case-sensitive on purpose: the site's name is a proper noun, while "Marvel
// Rivals meta" (the game's metagame) is ordinary glossary text that must not
// stop the whole feed.
const RIVALS_META_NAME = /Rivals\s*-?\s*Meta/;

interface BuiltFile {
  generatedAt: string;
  file: PulseAtlasFile;
}

interface BuiltDataset extends BuiltFile {
  dataset: PulseAtlasDataset;
}

/**
 * Builds every published file for one run: a wrapped file per dataset, one file
 * per tier-list season, and the manifest. Throws, naming every problem found,
 * if a dataset is missing, empty or malformed, or if it carries anything that
 * must not be public. Nothing is returned in that case, so a bad run publishes
 * nothing.
 *
 * The tier-list input is the full tier list, every season and rank. It is
 * published slimmed and split: `tier-list.json` holds an index of the seasons
 * (each with the path and hash of its own file) plus the current season's
 * ranks, and each season's ranks live in their own file. The season files are
 * not in the manifest; the index carries their hashes.
 *
 * A hero without a hero-styles entry, or an entry for a hero that is not in
 * the hero list, does not stop the run: hero-styles is published with only the
 * entries that match a hero, and each omission is reported through `warn`.
 * Likewise a tier-list hero that heroes.json does not know is published and
 * reported, not refused.
 *
 * The hero-stats input is the full per-half-season table (see
 * `assembleCommunityHeroStats`). It is checked against an allow-list of keys and
 * published whole, rounded, in one file: it is small, and a client that syncs
 * what the manifest lists then gets it with the rest. A season with no matches
 * is valid; only a malformed table or a source other than the community's
 * refuses the build.
 *
 * The `hero-game-ids` input is the map from each hero's slug to the game's
 * numeric hero id. It is merged into `heroes.json` (as `gameId`, plus
 * `gameIdVariants` for a hero the game splits by role) and is not a published
 * file. A hero without an entry is published without a `gameId` and reported
 * through `warn`; a malformed map refuses the build.
 *
 * `previous` is what is published right now. A dataset whose data (and source)
 * has not changed keeps that file's bytes verbatim, so its `generatedAt` and
 * hash stay put and a client holding that hash can skip the download.
 */
export function buildPulseAtlas(
  inputs: readonly PulseAtlasInput[],
  generatedAt: string,
  sha256: Sha256Hex,
  previous: readonly PulseAtlasFile[] = [],
  warn: (warning: string) => void = () => undefined,
): PulseAtlasFile[] {
  const prepared = inputs.map(toPublicInput);
  const problems = findProblems(prepared);

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas refused to build:\n- ${problems.join('\n- ')}`);
  }

  const identified = withHeroGameIds(prepared);
  identified.warnings.forEach((warning) => warn(`hero-game-ids: ${warning}`));

  const styled = withPublishableHeroStyles(identified.inputs);
  styled.warnings.forEach((warning) => warn(`hero-styles: ${warning}`));

  const split = withTierListSplitBySeason(styled.inputs, generatedAt, sha256, previous);
  split.warnings.forEach((warning) => warn(`tier-list: ${warning}`));

  const counted = withPublishableHeroStats(split.inputs);
  counted.warnings.forEach((warning) => warn(`hero-stats: ${warning}`));

  const community = withPublishableCommunityStats(counted.inputs);
  community.warnings.forEach((warning) => warn(`community-stats: ${warning}`));

  const scored = withPublishableHeroScores(community.inputs);
  scored.warnings.forEach((warning) => warn(`hero-scores: ${warning}`));

  const built = PULSE_ATLAS_DATASETS.flatMap((dataset): BuiltDataset[] => {
    const input = scored.inputs.find((candidate) => candidate.dataset === dataset);

    return input ? [{ dataset, ...buildEnvelopeFile(datasetPath(dataset), input, generatedAt, previous) }] : [];
  });

  const manifest: PulseAtlasManifest = {
    schemaVersion: PULSE_ATLAS_SCHEMA_VERSION,
    generatedAt: built.map((item) => item.generatedAt).reduce((a, b) => (a > b ? a : b)),
    files: built.map(({ dataset, file }) => ({
      dataset,
      path: file.path,
      sha256: sha256(file.content),
      bytes: byteLength(file.content),
    })),
  };

  return [
    ...built.map(({ file }) => file),
    ...split.seasonFiles,
    { path: PULSE_ATLAS_MANIFEST_PATH, content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
}

/**
 * Checks files as they will be served (read back from disk) against their
 * manifest: every dataset is listed, and its path, hash and size all match.
 * Also checks the tier-list index against the season files: each season has a
 * file at its path whose hash matches the index, and only the current season
 * carries ranks in the index. Throws on any mismatch or on a manifest that is
 * not shaped as documented.
 */
export function verifyPulseAtlas(files: readonly PulseAtlasFile[], sha256: Sha256Hex): void {
  const manifestFile = files.find((file) => file.path === PULSE_ATLAS_MANIFEST_PATH);

  if (!manifestFile) {
    throw new Error(`Pulse Atlas has no ${PULSE_ATLAS_MANIFEST_PATH}.`);
  }

  const manifest = parseManifest(manifestFile.content);
  const problems: string[] = [];

  for (const dataset of PULSE_ATLAS_DATASETS) {
    const entry = manifest.files.find((candidate) => candidate.dataset === dataset);
    const file = files.find((candidate) => candidate.path === datasetPath(dataset));

    if (!entry && !file && PULSE_ATLAS_OPTIONAL_DATASETS.includes(dataset)) {
      continue;
    }

    if (!entry || !file) {
      problems.push(`${dataset}: missing from the manifest or the published files`);
    } else if (entry.path !== file.path) {
      problems.push(`${dataset}: manifest path does not match the file`);
    } else if (entry.sha256 !== sha256(file.content)) {
      problems.push(`${dataset}: hash does not match the manifest`);
    } else if (entry.bytes !== byteLength(file.content)) {
      problems.push(`${dataset}: bytes does not match the manifest`);
    }
  }

  problems.push(...findSeasonFileProblems(files, sha256));
  COMMUNITY_DATASETS.forEach((dataset) => problems.push(...findProvenanceFileProblems(files, dataset)));

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas failed verification:\n- ${problems.join('\n- ')}`);
  }
}

/** The top-level `provenance` of the tier-list index and of every season file. The overlay refuses a tier-list file without it. */
const COMMUNITY_PROVENANCE = 'rivals-pulse-community';

/** The one rank the community list covers: the uploader's own rank is not stored with the matches. */
const ALL_RANKS = { value: '99', label: 'All Ranks' } as const;

/** One `/api/hero-stats` answer, read for what the tier list needs. */
interface StatsHalfSeason {
  id: number;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface StatsHero {
  hero: string;
  appearances: number;
  wins: number;
  winRate: number;
  pickRate: number;
  kda: number | null;
  finalHitsAverage: number | null;
}

interface HeroStatsView {
  /** Appearances a hero needs before it is placed. */
  minimumMatches: number;
  /** Every half-season that has started, oldest first. */
  halfSeasons: StatsHalfSeason[];
  /** The half-season the numbers come from; null before any half-season exists. */
  shown: StatsHalfSeason | null;
  /** Set when `shown` is the previous half-season, standing in for the one it names. */
  inPlaceOf: StatsHalfSeason | null;
  matchesCounted: number;
  tiers: { name: string; heroes: StatsHero[] }[];
  belowMinimum: { hero: string; appearances: number }[];
}

interface HalfSeasonStats {
  /** The half-season asked for, such as 10 or 10.5. */
  halfSeason: number;
  /** The `/api/hero-stats?halfSeason=<halfSeason>` response body. */
  response: unknown;
}

/** The tier-list season id of a half-season: twice its number, so 10.5 is 21 and 10 is 20. */
function seasonIdOf(halfSeason: number): number {
  const id = halfSeason * 2;

  if (!Number.isInteger(id)) {
    throw new Error(`Half-season ${halfSeason} is not a whole or a half number, so it has no season id.`);
  }

  return id;
}

/**
 * Folds the hero-stats answers into the one tier-list shape the gate checks: every started
 * half-season as a season (id = half-season x 2), each with one `99` (All Ranks) snapshot. `current`
 * is the default answer, which also says which half-season is current and whether it stands in for
 * the previous one; `others` are the exact answers (the current half-season's is not read). Hero ids become the game's numeric
 * ids through `heroGameIds` (a hero without an entry is left out, with a warning). Throws if an
 * answer is missing, or is for another half-season than was asked for.
 */
export function assembleCommunityTierList(
  current: unknown,
  others: readonly HalfSeasonStats[],
  heroGameIds: unknown,
  warn: (warning: string) => void = () => undefined,
): unknown {
  const currentView = readHeroStats(current, '/api/hero-stats');
  const currentId = currentHalfSeasonOf(currentView);
  const { gameIdOf, unmapped } = heroGameIdLookup(heroGameIds);

  const seasons = currentView.halfSeasons.map((season) => {
    // The current half-season's own answer may show the previous one, which is what the tier list keeps.
    const view = season.id === currentId ? currentView : readExactHalfSeason(season.id, others);

    return {
      id: seasonIdOf(season.id),
      label: season.label,
      ...(season.startsAt === null ? {} : { startTime: season.startsAt }),
      ...(season.endsAt === null ? {} : { endTime: season.endsAt }),
      ranks: { [ALL_RANKS.value]: snapshotOf(view, gameIdOf) },
    };
  });

  unmapped.forEach((hero) => warn(`${hero}: no gameId in hero-game-ids.json, so the hero is left out of the tier list`));

  return {
    provenance: COMMUNITY_PROVENANCE,
    currentSeasonId: seasonIdOf(currentId),
    rankFilters: [ALL_RANKS],
    seasons,
  };
}

// The answer for exactly one half-season: not another one, and not one standing in for it.
function readExactHalfSeason(halfSeason: number, answers: readonly HalfSeasonStats[]): HeroStatsView {
  const view = readHeroStats(
    answers.find((item) => item.halfSeason === halfSeason)?.response,
    `/api/hero-stats?halfSeason=${halfSeason}`,
  );

  if (view.shown?.id !== halfSeason || view.inPlaceOf !== null) {
    const standingIn = view.inPlaceOf ? ` in place of ${view.inPlaceOf.id}` : '';

    throw new Error(`The hero-stats API answered for half-season ${view.shown?.id ?? 'none'}${standingIn}, not ${halfSeason}.`);
  }

  return view;
}

// Hero slug to the game's numeric hero id, noting each slug that has none.
function heroGameIdLookup(heroGameIds: unknown): { gameIdOf: (hero: string) => number | undefined; unmapped: Set<string> } {
  const gameIdBySlug = new Map(
    (Array.isArray(heroGameIds) ? heroGameIds : []).flatMap((entry) =>
      isRecord(entry) && isNonEmptyString(entry['id']) && isInteger(entry['gameId'])
        ? [[entry['id'], entry['gameId']] as const]
        : [],
    ),
  );
  const unmapped = new Set<string>();

  return {
    unmapped,
    gameIdOf: (hero) => {
      const gameId = gameIdBySlug.get(hero);

      if (gameId === undefined) {
        unmapped.add(hero);
      }

      return gameId;
    },
  };
}

// The default answer shows the previous half-season while the current one has no placed hero, so
// the current half-season is the one it stands in for.
function currentHalfSeasonOf(view: HeroStatsView): number {
  const current = view.inPlaceOf ?? view.shown;

  if (!current) {
    throw new Error('The hero-stats API has no half-season yet, so there is nothing to publish.');
  }

  return current.id;
}

function snapshotOf(view: HeroStatsView, gameIdOf: (hero: string) => number | undefined): unknown {
  return {
    tiers: view.tiers.map((tier) => ({
      name: tier.name,
      heroes: tier.heroes.flatMap((hero) => {
        const heroId = gameIdOf(hero.hero);

        return heroId === undefined
          ? []
          : [{ heroId, winRate: hero.winRate, pickRate: hero.pickRate, matches: hero.appearances, wins: hero.wins }];
      }),
    })),
    matchesCounted: view.matchesCounted,
    minimumMatches: view.minimumMatches,
    belowMinimum: view.belowMinimum.flatMap((hero) => {
      const heroId = gameIdOf(hero.hero);

      return heroId === undefined ? [] : [{ heroId, matches: hero.appearances }];
    }),
    ...(view.inPlaceOf && view.shown ? { fallbackFromSeasonId: seasonIdOf(view.shown.id) } : {}),
  };
}

/**
 * Every started half-season, to be asked for exactly (`/api/hero-stats?halfSeason=<id>`), the
 * current one included: the default answer may be the previous half-season standing in for it, and
 * the hero-stats file never shows one half-season's numbers as another's. Throws when the default
 * answer lists no half-season (or is an older API that does not list them at all), so a feed is
 * never built from a web app that has not been deployed yet.
 */
export function communityHalfSeasonRequests(current: unknown): number[] {
  const view = readHeroStats(current, '/api/hero-stats');
  currentHalfSeasonOf(view);

  return view.halfSeasons.map((season) => season.id);
}

/**
 * Folds the hero-stats answers into the `hero-stats` dataset the gate checks: every started
 * half-season as a season (id = half-season x 2, as in the tier list), each with one cell per hero
 * that has any match. `current` is the default answer, which lists the half-seasons and says which
 * is current; `exact` holds the answer asked for each of them, which is the only place a season's
 * numbers come from. A hero at or above the minimum carries its win rate, pick rate, KDA and final
 * hits; one below it carries only its appearances, because that is all the API reports for it, and
 * is flagged `enoughData: false`. Hero ids become the game's numeric ids through `heroGameIds`
 * (a hero without an entry is left out, with a warning). Throws if an answer is missing, is for
 * another half-season, or stands in for one.
 */
export function assembleCommunityHeroStats(
  current: unknown,
  exact: readonly HalfSeasonStats[],
  heroGameIds: unknown,
  warn: (warning: string) => void = () => undefined,
): unknown {
  const currentView = readHeroStats(current, '/api/hero-stats');
  const currentId = currentHalfSeasonOf(currentView);
  const { gameIdOf, unmapped } = heroGameIdLookup(heroGameIds);

  const seasons = currentView.halfSeasons.map((season) => {
    const view = readExactHalfSeason(season.id, exact);
    const placed = view.tiers.flatMap((tier) => tier.heroes).map((hero) => ({ ...hero, enoughData: true }));
    const unplaced = view.belowMinimum.map((hero) => ({
      ...hero,
      enoughData: false,
      winRate: null,
      pickRate: null,
      kda: null,
      finalHitsAverage: null,
    }));

    return {
      id: seasonIdOf(season.id),
      label: season.label,
      ...(season.startsAt === null ? {} : { startTime: season.startsAt }),
      ...(season.endsAt === null ? {} : { endTime: season.endsAt }),
      decidedMatches: view.matchesCounted,
      heroes: [...placed, ...unplaced].flatMap((hero) => {
        const heroId = gameIdOf(hero.hero);

        return heroId === undefined
          ? []
          : [
              {
                heroId,
                appearances: hero.appearances,
                enoughData: hero.enoughData,
                winRate: hero.winRate,
                pickRate: hero.pickRate,
                kda: hero.kda,
                finalHitsAverage: hero.finalHitsAverage,
              },
            ];
      }),
    };
  });

  unmapped.forEach((hero) => warn(`${hero}: no gameId in hero-game-ids.json, so the hero is left out of hero-stats`));

  return {
    provenance: COMMUNITY_PROVENANCE,
    minimumMatches: currentView.minimumMatches,
    currentSeasonId: seasonIdOf(currentId),
    seasons,
  };
}

function readHeroStats(response: unknown, what: string): HeroStatsView {
  const problem = (detail: string): Error =>
    new Error(`${what} is not the hero-stats shape (${detail}). Has the web app been deployed with it?`);

  if (!isRecord(response) || !Array.isArray(response['halfSeasons']) || !Array.isArray(response['tiers'])) {
    throw problem('no halfSeasons and tiers lists');
  }

  const numberOf = (record: Record<string, unknown>, key: string): number => {
    const value = record[key];

    if (!isFiniteNumber(value)) {
      throw problem(`${key} is not a number`);
    }

    return value;
  };
  const nullableNumberOf = (record: Record<string, unknown>, key: string): number | null =>
    record[key] === null ? null : numberOf(record, key);
  const halfSeasonOf = (value: unknown): StatsHalfSeason => {
    if (
      !isRecord(value) ||
      !isNonEmptyString(value['label']) ||
      !isNullableString(value['startsAt']) ||
      !isNullableString(value['endsAt'])
    ) {
      throw problem('a half-season needs an id, a label and startsAt and endsAt');
    }

    return {
      id: numberOf(value, 'id'),
      label: value['label'],
      startsAt: value['startsAt'],
      endsAt: value['endsAt'],
    };
  };
  const optionalHalfSeason = (value: unknown): StatsHalfSeason | null => (value === null ? null : halfSeasonOf(value));
  const heroOf = (value: unknown): StatsHero => {
    if (!isRecord(value) || !isNonEmptyString(value['hero'])) {
      throw problem('a hero needs an id');
    }

    return {
      hero: value['hero'],
      appearances: numberOf(value, 'appearances'),
      wins: numberOf(value, 'wins'),
      winRate: numberOf(value, 'winRate'),
      pickRate: numberOf(value, 'pickRate'),
      kda: nullableNumberOf(value, 'kda'),
      finalHitsAverage: nullableNumberOf(value, 'finalHitsAverage'),
    };
  };
  const belowMinimum: unknown[] = Array.isArray(response['belowMinimum']) ? response['belowMinimum'] : [];

  return {
    minimumMatches: numberOf(response, 'minimumMatches'),
    halfSeasons: response['halfSeasons'].map(halfSeasonOf),
    shown: optionalHalfSeason(response['halfSeason']),
    inPlaceOf: optionalHalfSeason(response['inPlaceOf']),
    matchesCounted: numberOf(response, 'matchesCounted'),
    tiers: response['tiers'].map((tier) => {
      if (!isRecord(tier) || !isNonEmptyString(tier['name']) || !Array.isArray(tier['heroes'])) {
        throw problem('a tier needs a name and a heroes list');
      }

      return { name: tier['name'], heroes: tier['heroes'].map(heroOf) };
    }),
    belowMinimum: belowMinimum.map((hero) => {
      if (!isRecord(hero) || !isNonEmptyString(hero['hero'])) {
        throw problem('a below-minimum hero needs an id');
      }

      return { hero: hero['hero'], appearances: numberOf(hero, 'appearances') };
    }),
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

// Wraps `data` in the envelope, unless the file published at `path` already holds
// the same data and source: then its bytes are kept, so its hash stays put.
function buildEnvelopeFile(
  path: string,
  input: Pick<PulseAtlasInput, 'source' | 'data'>,
  generatedAt: string,
  previous: readonly PulseAtlasFile[],
): BuiltFile {
  const unchanged = findUnchanged(input, previous.find((file) => file.path === path));

  if (unchanged) {
    return { generatedAt: unchanged.envelope.generatedAt, file: unchanged.file };
  }

  const envelope: PulseAtlasEnvelope = {
    schemaVersion: PULSE_ATLAS_SCHEMA_VERSION,
    generatedAt,
    source: input.source,
    data: input.data,
  };

  return { generatedAt, file: { path, content: `${JSON.stringify(envelope)}\n` } };
}

function findUnchanged(
  input: Pick<PulseAtlasInput, 'source' | 'data'>,
  published: PulseAtlasFile | undefined,
): { envelope: PulseAtlasEnvelope; file: PulseAtlasFile } | undefined {
  const envelope = published ? parseEnvelope(published.content) : undefined;

  if (
    !published ||
    !envelope ||
    envelope.schemaVersion !== PULSE_ATLAS_SCHEMA_VERSION ||
    envelope.source !== input.source ||
    canonicalJson(envelope.data) !== canonicalJson(input.data)
  ) {
    return undefined;
  }

  return { envelope, file: published };
}

function parseEnvelope(content: string): PulseAtlasEnvelope | undefined {
  const parsed = tryParseJson(content);

  if (
    !isRecord(parsed) ||
    typeof parsed['schemaVersion'] !== 'number' ||
    !isNonEmptyString(parsed['generatedAt']) ||
    typeof parsed['source'] !== 'string' ||
    !('data' in parsed)
  ) {
    return undefined;
  }

  return {
    schemaVersion: parsed['schemaVersion'],
    generatedAt: parsed['generatedAt'],
    source: parsed['source'],
    data: parsed['data'],
  };
}

export function parseManifest(content: string): PulseAtlasManifest {
  const parsed = tryParseJson(content);
  const files = isRecord(parsed) ? parsed['files'] : undefined;

  if (
    !isRecord(parsed) ||
    typeof parsed['schemaVersion'] !== 'number' ||
    !isNonEmptyString(parsed['generatedAt']) ||
    !Array.isArray(files)
  ) {
    throw new Error('Pulse Atlas manifest is not shaped { schemaVersion, generatedAt, files }.');
  }

  const entries = files.map((entry): PulseAtlasManifestEntry => {
    const dataset = isRecord(entry) ? PULSE_ATLAS_DATASETS.find((name) => name === entry['dataset']) : undefined;

    if (
      !isRecord(entry) ||
      !dataset ||
      !isNonEmptyString(entry['path']) ||
      !isNonEmptyString(entry['sha256']) ||
      !Number.isInteger(entry['bytes'])
    ) {
      throw new Error('Pulse Atlas manifest has a file entry without dataset, path, sha256 and bytes.');
    }

    return {
      dataset,
      path: entry['path'],
      sha256: entry['sha256'],
      bytes: Number(entry['bytes']),
    };
  });

  return { schemaVersion: parsed['schemaVersion'], generatedAt: parsed['generatedAt'], files: entries };
}

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function toPublicInput(input: PulseAtlasInput): PulseAtlasInput {
  if (input.dataset !== 'heroes' || !Array.isArray(input.data)) {
    return input;
  }

  const heroes = input.data.map((hero) => {
    if (!isRecord(hero)) {
      return hero;
    }

    const { counters: _counters, ...publicHero } = hero;
    return publicHero;
  });

  return { ...input, data: heroes };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (isRecord(value)) {
    const members = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);

    return `{${members.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function datasetPath(dataset: PulseAtlasDataset): string {
  return `${PULSE_ATLAS_BASE_PATH}/${dataset}.json`;
}

function findProblems(inputs: readonly PulseAtlasInput[]): string[] {
  const problems: string[] = [];

  for (const dataset of PULSE_ATLAS_DATASETS) {
    const matches = inputs.filter((input) => input.dataset === dataset);

    if (matches.length === 0 && PULSE_ATLAS_OPTIONAL_DATASETS.includes(dataset)) {
      continue;
    }

    if (matches.length !== 1) {
      problems.push(`${dataset}: expected exactly one input, got ${matches.length}`);
      continue;
    }

    const [input] = matches;
    const shapeProblem = describeShapeProblem(dataset, input.data, inputs);

    if (!input.source.trim()) {
      problems.push(`${dataset}: source label is empty`);
    }

    if (shapeProblem) {
      problems.push(`${dataset}: ${shapeProblem}`);
    } else {
      problems.push(...findUnsafeContent(input.data, dataset, dataset === 'community-stats' ? PRIVATE_KEY : UNSAFE_KEY));
    }
  }

  const gameIds = inputs.filter((input) => input.dataset === PULSE_ATLAS_HERO_GAME_IDS);

  if (gameIds.length !== 1) {
    problems.push(`${PULSE_ATLAS_HERO_GAME_IDS}: expected exactly one input, got ${gameIds.length}`);
  } else {
    const { errors } = findHeroGameIdProblems(gameIds[0].data, publishedHeroIds(inputs));
    problems.push(...errors.map((error) => `${PULSE_ATLAS_HERO_GAME_IDS}: ${error}`));
  }

  return problems;
}

function describeShapeProblem(
  dataset: PulseAtlasDataset,
  data: unknown,
  inputs: readonly PulseAtlasInput[],
): string | undefined {
  switch (dataset) {
    case 'heroes':
      return describeListProblem(data, ['id', 'name']);
    case 'glossary':
      return describeListProblem(data, ['id', 'term']);
    case 'maps':
      return describeMapListProblem(data);
    case 'tier-list':
      return describeTierListProblem(data);
    case 'hero-styles':
      return describeHeroStylesProblem(data, publishedHeroIds(inputs));
    case 'strategist-tags':
      return describeStrategistTagsProblem(data, inputs);
    case 'hero-stats':
      return describeHeroStatsProblem(data);
    case 'community-stats':
      return describeCommunityStatsProblem(data);
    case 'hero-scores':
      return readHeroScores(data).problems.join('; ') || undefined;
    case 'team-lineups':
      return readTeamLineups(data).join('; ') || undefined;
  }
}

function describeStrategistTagsProblem(data: unknown, inputs: readonly PulseAtlasInput[]): string | undefined {
  const heroes = inputs.find((input) => input.dataset === 'heroes')?.data;
  const gameIds = inputs.find((input) => input.dataset === PULSE_ATLAS_HERO_GAME_IDS)?.data;
  const errors = findStrategistTagProblems(
    data,
    publishedHeroIds(inputs) !== undefined && Array.isArray(heroes) ? heroes : undefined,
    gameIds,
  );

  return errors.length > 0 ? errors.join('; ') : undefined;
}

function publishedHeroIds(inputs: readonly PulseAtlasInput[]): string[] | undefined {
  const heroes = inputs.find((input) => input.dataset === 'heroes')?.data;

  // A malformed hero list is reported on its own; there is nothing to check styles against.
  return Array.isArray(heroes) && heroes.length > 0 && heroes.every((hero) => isRecord(hero) && isNonEmptyString(hero['id']))
    ? heroes.map((hero) => String(hero['id']))
    : undefined;
}

interface HeroStyleFindings {
  /** Faults in the data itself; a build must not publish while any remain. */
  errors: string[];
  /** Mismatches with the hero list; publishing goes ahead without the affected hero. */
  warnings: string[];
}

/**
 * Everything wrong with a hero-styles list, split by how serious it is.
 *
 * Errors: the list is empty, an entry has no hero, a hero is listed twice, a
 * weight is not a whole, non-negative number, poke, dive and brawl do not sum
 * to exactly 100, or (given `heroIds`) no entry names a hero in `heroIds`.
 *
 * Warnings (only given `heroIds`): a hero in `heroIds` has no entry, or an
 * entry names a hero outside `heroIds`. A new hero is released before anyone
 * has rated its playstyle, and that must not freeze the whole feed.
 */
export function findHeroStyleProblems(styles: unknown, heroIds?: readonly string[]): HeroStyleFindings {
  if (!Array.isArray(styles) || styles.length === 0) {
    return { errors: ['expected a non-empty list'], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  styles.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry['heroId'])) {
      errors.push(`entry ${index} needs a non-empty string heroId`);
      return;
    }

    const heroId = entry['heroId'];

    if (seen.has(heroId)) {
      errors.push(`${heroId}: listed more than once`);
    }
    seen.add(heroId);

    if (heroIds && !heroIds.includes(heroId)) {
      warnings.push(`${heroId}: not a hero in heroes.json, so it is left out of hero-styles.json`);
    }

    const weights = HERO_STYLE_WEIGHTS.map((weight) => entry[weight]);

    if (!weights.every((weight) => Number.isInteger(weight) && Number(weight) >= 0)) {
      errors.push(`${heroId}: ${HERO_STYLE_WEIGHTS.join(', ')} must each be a whole number of 0 or more`);
    } else if (weights.reduce((total: number, weight) => total + Number(weight), 0) !== 100) {
      errors.push(`${heroId}: ${HERO_STYLE_WEIGHTS.join(' + ')} must add up to exactly 100`);
    }
  });

  for (const heroId of heroIds ?? []) {
    if (!seen.has(heroId)) {
      warnings.push(`${heroId}: no entry in hero-styles.json, so the hero has no playstyle weights yet`);
    }
  }

  // Every entry being unmatched means the file is for something else, not that
  // heroes are new; publishing it would silently empty the file.
  if (heroIds && !heroIds.some((heroId) => seen.has(heroId))) {
    errors.push('no entry names a hero in heroes.json');
  }

  return { errors, warnings };
}

function describeHeroStylesProblem(data: unknown, heroIds: readonly string[] | undefined): string | undefined {
  const { errors } = findHeroStyleProblems(data, heroIds);

  return errors.length > 0 ? errors.join('; ') : undefined;
}

/**
 * The inputs with hero-styles cut down to the entries that name a hero in the
 * hero list, plus a warning for each hero or entry that did not match. Expects
 * inputs that already passed `findProblems`.
 */
function withPublishableHeroStyles(inputs: readonly PulseAtlasInput[]): {
  inputs: PulseAtlasInput[];
  warnings: string[];
} {
  const heroIds = publishedHeroIds(inputs);
  const styles = inputs.find((input) => input.dataset === 'hero-styles');

  if (!heroIds || !styles || !Array.isArray(styles.data)) {
    return { inputs: [...inputs], warnings: [] };
  }

  const { warnings } = findHeroStyleProblems(styles.data, heroIds);
  const matching = styles.data.filter((entry) => isRecord(entry) && heroIds.includes(String(entry['heroId'])));

  return {
    inputs: inputs.map((input) => (input === styles ? { ...input, data: matching } : input)),
    warnings,
  };
}

interface HeroGameIdFindings {
  /** Faults in the map itself; a build must not publish while any remain. */
  errors: string[];
  /** Mismatches with the hero list; publishing goes ahead without the affected hero's id. */
  warnings: string[];
}

/**
 * Everything wrong with the hero game-id map, split by how serious it is.
 *
 * Errors: the list is empty, an entry has no slug or no positive whole
 * `gameId`, a slug is listed twice, one numeric id belongs to two heroes (or to
 * a hero and its own variant), `gameIdVariants` is not a non-empty list of
 * `{ gameId, role }` with a real role, an entry has a key other than
 * `id`, `gameId` and `gameIdVariants`, or (given `heroIds`) no entry names a
 * hero in `heroIds`.
 *
 * Warnings (only given `heroIds`): a hero in `heroIds` has no entry, or an
 * entry names a hero outside `heroIds`. A new hero is released before anyone
 * has looked up its id, and that must not freeze the whole feed.
 */
export function findHeroGameIdProblems(entries: unknown, heroIds?: readonly string[]): HeroGameIdFindings {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { errors: ['expected a non-empty list'], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const slugs = new Set<string>();
  const owners = new Map<number, string>();
  const claim = (gameId: number, slug: string): void => {
    const owner = owners.get(gameId);

    if (owner === undefined) {
      owners.set(gameId, slug);
    } else {
      errors.push(`${slug}: gameId ${gameId} is already ${owner === slug ? 'used twice by this hero' : `${owner}'s`}`);
    }
  };

  entries.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry['id'])) {
      errors.push(`entry ${index} needs a non-empty string id`);
      return;
    }

    const slug = entry['id'];

    if (slugs.has(slug)) {
      errors.push(`${slug}: listed more than once`);
    }
    slugs.add(slug);

    if (heroIds && !heroIds.includes(slug)) {
      warnings.push(`${slug}: not a hero in heroes.json, so its gameId is left out of the feed`);
    }

    // Only these keys are published onto the hero; a stray one is a typo, not data to pass along.
    const stray = Object.keys(entry).filter((key) => !GAME_ID_ENTRY_KEYS.includes(key));

    if (stray.length > 0) {
      errors.push(`${slug}: unknown key ${stray.join(', ')}; an entry holds only ${GAME_ID_ENTRY_KEYS.join(', ')}`);
    }

    if (!isPositiveInteger(entry['gameId'])) {
      errors.push(`${slug}: gameId must be a whole number above 0`);
    } else {
      claim(entry['gameId'], slug);
    }

    const variants = entry['gameIdVariants'];

    if (variants === undefined) {
      return;
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      errors.push(`${slug}: gameIdVariants must be a non-empty list when present`);
      return;
    }

    for (const variant of variants) {
      if (
        !isRecord(variant) ||
        !isPositiveInteger(variant['gameId']) ||
        !HERO_ROLES.some((role) => role === variant['role'])
      ) {
        errors.push(`${slug}: every gameIdVariants entry needs a whole gameId above 0 and a role of ${HERO_ROLES.join(', ')}`);
      } else {
        claim(variant['gameId'], slug);
      }
    }
  });

  for (const heroId of heroIds ?? []) {
    if (!slugs.has(heroId)) {
      warnings.push(`${heroId}: no entry in hero-game-ids.json, so the hero is published without a gameId`);
    }
  }

  // Every entry being unmatched means the map is for something else, not that
  // heroes are new; publishing it would silently strip every id.
  if (heroIds && !heroIds.some((heroId) => slugs.has(heroId))) {
    errors.push('no entry names a hero in heroes.json');
  }

  return { errors, warnings };
}

/**
 * The inputs with each hero in heroes.json given its numeric game id from the
 * map, plus a warning for each hero or entry that did not match. Expects
 * inputs that already passed `findProblems`.
 */
function withHeroGameIds(inputs: readonly PulseAtlasInput[]): { inputs: PulseAtlasInput[]; warnings: string[] } {
  const heroes = inputs.find((input) => input.dataset === 'heroes');
  const map = inputs.find((input) => input.dataset === PULSE_ATLAS_HERO_GAME_IDS);
  const heroIds = publishedHeroIds(inputs);

  if (!heroes || !map || !heroIds || !Array.isArray(heroes.data) || !Array.isArray(map.data)) {
    return { inputs: [...inputs], warnings: [] };
  }

  const entries = new Map(map.data.flatMap((entry) => (isRecord(entry) ? [[String(entry['id']), entry] as const] : [])));
  const identified = heroes.data.map((hero) => {
    const entry = isRecord(hero) ? entries.get(String(hero['id'])) : undefined;

    if (!isRecord(hero) || !entry) {
      return hero;
    }

    const { gameId, gameIdVariants } = entry;
    return { ...hero, gameId, ...(gameIdVariants === undefined ? {} : { gameIdVariants }) };
  });

  return {
    inputs: inputs.map((input) => (input === heroes ? { ...input, data: identified } : input)),
    warnings: findHeroGameIdProblems(map.data, heroIds).warnings,
  };
}

function describeListProblem(data: unknown, stringFields: readonly string[]): string | undefined {
  if (!Array.isArray(data) || data.length === 0) {
    return 'expected a non-empty list';
  }

  const bad = data.findIndex(
    (item) => !isRecord(item) || stringFields.some((field) => !isNonEmptyString(item[field])),
  );

  return bad === -1
    ? undefined
    : `item ${bad} needs a non-empty string ${stringFields.join(' and ')}`;
}

function describeMapListProblem(data: unknown): string | undefined {
  if (!Array.isArray(data) || data.length === 0) {
    return 'expected a non-empty list';
  }

  const bad = data.findIndex(
    (item) => !isRecord(item) || !Number.isInteger(item['id']) || !isNonEmptyString(item['name']),
  );

  return bad === -1 ? undefined : `item ${bad} needs an integer id and a non-empty string name`;
}

function describeTierListProblem(data: unknown): string | undefined {
  const { problems } = readTierList(data);

  return problems.length > 0 ? problems.join('; ') : undefined;
}

/** A hero row as published: the game's hero id and the numbers, nothing a consumer can join in. */
interface SlimHeroRow {
  heroId: number;
  winRate: number;
  pickRate: number;
  matches: number;
  wins: number;
}

/** A hero with too few matches to be placed in a tier. */
interface BelowMinimumRow {
  heroId: number;
  matches: number;
}

interface SlimSnapshot {
  tiers: (Record<string, unknown> & { heroes: SlimHeroRow[] })[];
  matchesCounted?: number;
  /** Appearances a hero needs before it is placed; what each `belowMinimum` row counts toward. */
  minimumMatches?: number;
  belowMinimum?: BelowMinimumRow[];
  /** Set when the numbers are the previous season's, standing in for a season with no placed hero yet. */
  fallbackFromSeasonId?: number;
}

interface TierListSeason {
  id: number;
  /** Everything about the season except its ranks. */
  details: Record<string, unknown>;
  ranks: Record<string, SlimSnapshot>;
}

interface ReadTierList {
  /** Faults in the data; empty when `tierList` is set. */
  problems: string[];
  tierList?: {
    currentSeasonId: number;
    rankFilters: unknown[];
    seasons: TierListSeason[];
    /** Every hero that has a row anywhere, once per game hero id. */
    heroes: Set<number>;
    /** Seasons that list no hero at any rank: published as they are, and reported. */
    emptySeasonIds: number[];
  };
}

/**
 * Checks the full tier list (every season and rank, as `assembleCommunityTierList`
 * returns it) and, when it is sound, cuts every hero row down to what is
 * published. Faults are reported together so one run names them all. A list
 * that is not the community's is refused, so no other source can reach the feed.
 */
function readTierList(data: unknown): ReadTierList {
  if (isRecord(data) && data['provenance'] !== COMMUNITY_PROVENANCE) {
    return { problems: [`provenance must be "${COMMUNITY_PROVENANCE}"`] };
  }

  if (
    !isRecord(data) ||
    !Array.isArray(data['seasons']) ||
    data['seasons'].length === 0 ||
    !Array.isArray(data['rankFilters']) ||
    data['rankFilters'].length === 0
  ) {
    return { problems: ['expected an object with non-empty seasons and rankFilters lists'] };
  }

  const rankFilters: unknown[] = data['rankFilters'];
  const ranks = rankFilters.map((filter) => (isRecord(filter) ? filter['value'] : undefined));

  if (!ranks.every(isNonEmptyString)) {
    return { problems: ['every rank filter needs a non-empty string value'] };
  }

  const problems: string[] = [];
  const seasons: TierListSeason[] = [];
  const emptySeasonIds: number[] = [];
  const heroes = new Set<number>();

  data['seasons'].forEach((season: unknown, index: number) => {
    if (!isRecord(season) || !isInteger(season['id']) || !isRecord(season['ranks'])) {
      problems.push(`season ${index} needs an integer id and a ranks object`);
      return;
    }

    const id = season['id'];
    const snapshots = season['ranks'];
    const missing = ranks.filter((rank) => !hasTiers(snapshots[rank]));

    if (missing.length > 0) {
      problems.push(`season ${id} has no tiers for rank ${missing.join(', ')}`);
      return;
    }

    if (!ranks.some((rank) => listsAnyHero(snapshots[rank]))) {
      emptySeasonIds.push(id);
    }

    const slimRanks: Record<string, SlimSnapshot> = {};

    for (const rank of ranks) {
      const slimmed = slimSnapshot(snapshots[rank], heroes);

      if (typeof slimmed === 'string') {
        problems.push(`season ${id} rank ${rank} ${slimmed}`);
        return;
      }

      slimRanks[rank] = slimmed;
    }

    const { ranks: _ranks, ...details } = season;
    seasons.push({ id, details, ranks: slimRanks });
  });

  const currentSeasonId = data['currentSeasonId'];

  if (!isInteger(currentSeasonId) || !data['seasons'].some((season) => isRecord(season) && season['id'] === currentSeasonId)) {
    problems.push(`currentSeasonId ${String(currentSeasonId)} is not one of the listed seasons`);
  }

  if (problems.length > 0 || !isInteger(currentSeasonId)) {
    return { problems };
  }

  return {
    problems,
    tierList: {
      currentSeasonId,
      rankFilters,
      seasons,
      heroes,
      emptySeasonIds,
    },
  };
}

// Reports the first row that cannot be published, as text, instead of a snapshot.
function slimSnapshot(snapshot: unknown, heroes: Set<number>): SlimSnapshot | string {
  if (!hasTiers(snapshot)) {
    return 'has no tiers';
  }

  const tiers: SlimSnapshot['tiers'] = [];

  for (const tier of snapshot.tiers) {
    if (!isRecord(tier) || !isNonEmptyString(tier['name']) || !Array.isArray(tier['heroes'])) {
      return `tier ${tiers.length} needs a name and a heroes list`;
    }

    const rows: SlimHeroRow[] = [];

    for (const row of tier['heroes']) {
      const slim = toSlimHeroRow(row);

      if (!slim) {
        return `tier ${tier['name']} hero ${rows.length} needs an integer heroId and numbers for winRate, pickRate, matches and wins`;
      }

      heroes.add(slim.heroId);
      rows.push(slim);
    }

    tiers.push({ ...tier, heroes: rows });
  }

  const { matchesCounted, minimumMatches, belowMinimum, fallbackFromSeasonId } = snapshot;

  if (matchesCounted !== undefined && !(isFiniteNumber(matchesCounted) && matchesCounted >= 0)) {
    return 'needs matchesCounted to be a non-negative number';
  }

  if (minimumMatches !== undefined && !isPositiveInteger(minimumMatches)) {
    return 'needs minimumMatches to be a whole number above 0';
  }

  if (fallbackFromSeasonId !== undefined && !isInteger(fallbackFromSeasonId)) {
    return 'needs fallbackFromSeasonId to be an integer';
  }

  const below = toBelowMinimum(belowMinimum, heroes);

  if (typeof below === 'string') {
    return below;
  }

  return {
    tiers,
    ...(matchesCounted === undefined ? {} : { matchesCounted }),
    ...(minimumMatches === undefined ? {} : { minimumMatches }),
    ...(below === undefined ? {} : { belowMinimum: below }),
    ...(fallbackFromSeasonId === undefined ? {} : { fallbackFromSeasonId }),
  };
}

// The heroes with data but too few matches to be placed. Reports the first bad row, as text.
function toBelowMinimum(list: unknown, heroes: Set<number>): BelowMinimumRow[] | string | undefined {
  if (list === undefined) {
    return undefined;
  }

  if (!Array.isArray(list)) {
    return 'needs belowMinimum to be a list';
  }

  const rows: BelowMinimumRow[] = [];

  for (const row of list) {
    if (!isRecord(row) || !isInteger(row['heroId']) || !isFiniteNumber(row['matches'])) {
      return `belowMinimum item ${rows.length} needs an integer heroId and a number of matches`;
    }

    heroes.add(row['heroId']);

    rows.push({ heroId: row['heroId'], matches: row['matches'] });
  }

  return rows;
}

// Rates are published to two decimals: more is noise that makes every file differ between syncs.
function toSlimHeroRow(row: unknown): SlimHeroRow | undefined {
  if (!isRecord(row)) {
    return undefined;
  }

  const { heroId, winRate, pickRate, matches, wins } = row;

  if (
    !isInteger(heroId) ||
    !isFiniteNumber(winRate) ||
    !isFiniteNumber(pickRate) ||
    !isFiniteNumber(matches) ||
    !isFiniteNumber(wins)
  ) {
    return undefined;
  }

  return {
    heroId,
    winRate: roundToHundredths(winRate),
    pickRate: roundToHundredths(pickRate),
    matches,
    wins,
  };
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

interface SplitTierList {
  /** The inputs with the tier list replaced by its index. */
  inputs: PulseAtlasInput[];
  seasonFiles: PulseAtlasFile[];
  warnings: string[];
}

/**
 * Splits the full tier-list input into one file per season and an index that
 * holds each file's path and hash, with the current season's ranks. The index
 * replaces the tier-list input, so it goes through the same change check as
 * every dataset; since it carries the season hashes, it changes exactly when a
 * season file does. Expects inputs that already passed `findProblems`.
 */
function withTierListSplitBySeason(
  inputs: readonly PulseAtlasInput[],
  generatedAt: string,
  sha256: Sha256Hex,
  previous: readonly PulseAtlasFile[],
): SplitTierList {
  const input = inputs.find((candidate) => candidate.dataset === 'tier-list');
  const { tierList } = input ? readTierList(input.data) : { tierList: undefined };

  if (!input || !tierList) {
    return { inputs: [...inputs], seasonFiles: [], warnings: [] };
  }

  const seasonFiles = tierList.seasons.map((season) => ({
    season,
    ...buildEnvelopeFile(
      tierListSeasonPath(season.id),
      { source: input.source, data: { provenance: COMMUNITY_PROVENANCE, ...season.details, ranks: season.ranks } },
      generatedAt,
      previous,
    ),
  }));

  const index = {
    provenance: COMMUNITY_PROVENANCE,
    currentSeasonId: tierList.currentSeasonId,
    rankFilters: tierList.rankFilters,
    seasons: seasonFiles.map(({ season, file }) => ({
      ...season.details,
      path: file.path,
      sha256: sha256(file.content),
      ...(season.id === tierList.currentSeasonId ? { ranks: season.ranks } : {}),
    })),
  };

  return {
    inputs: inputs.map((candidate) => (candidate === input ? { ...candidate, data: index } : candidate)),
    seasonFiles: seasonFiles.map(({ file }) => file),
    warnings: [
      ...tierList.emptySeasonIds.map((id) => `season ${id} lists no hero yet, so it is published with empty tiers`),
      ...describeUnknownHeroes(tierList.heroes, inputs.find((candidate) => candidate.dataset === 'heroes')?.data),
    ],
  };
}

// A tier-list heroId joins to heroes.json through a hero's gameId, or the gameId of one of its role
// variants. A hero that does not join is published all the same: a new hero reaches the tier list
// before anyone has added its id to hero-game-ids.json, and that must not freeze the feed.
function describeUnknownHeroes(listed: ReadonlySet<number>, heroes: unknown): string[] {
  const known = new Set(
    (Array.isArray(heroes) ? heroes : []).flatMap((hero) => {
      if (!isRecord(hero)) {
        return [];
      }

      const variants = Array.isArray(hero['gameIdVariants']) ? hero['gameIdVariants'] : [];
      return [hero['gameId'], ...variants.map((variant) => (isRecord(variant) ? variant['gameId'] : undefined))];
    }),
  );

  return [...listed]
    .filter((heroId) => !known.has(heroId))
    .map((heroId) => `heroId ${heroId} is the gameId of no hero in heroes.json, so it is published without one to join to`);
}

/** The keys a hero-stats file, season and cell may carry: the allow-list. Anything else refuses the build. */
const HERO_STATS_KEYS: readonly string[] = ['provenance', 'minimumMatches', 'currentSeasonId', 'seasons'];
const HERO_STATS_SEASON_KEYS: readonly string[] = ['id', 'label', 'startTime', 'endTime', 'decidedMatches', 'heroes'];
const HERO_STATS_CELL_KEYS: readonly string[] = [
  'heroId',
  'appearances',
  'enoughData',
  'winRate',
  'pickRate',
  'kda',
  'finalHitsAverage',
];
const HERO_STATS_RATE_KEYS = ['winRate', 'pickRate', 'kda', 'finalHitsAverage'] as const;

/** The published `hero-stats` dataset: every half-season with a cell per hero, in one file. */
interface HeroStatsTable {
  provenance: typeof COMMUNITY_PROVENANCE;
  minimumMatches: number;
  currentSeasonId: number;
  seasons: Record<string, unknown>[];
}

interface ReadHeroStats {
  /** Faults in the data; empty when `table` is set. */
  problems: string[];
  /** The data as it is published: only allow-listed keys, rates to two decimals, cells by hero id. */
  table?: HeroStatsTable;
  /** Every hero id that has a cell anywhere. */
  heroes?: Set<number>;
}

/**
 * Checks the hero-stats dataset and, when it is sound, returns it cut down to what is published.
 * Faults are reported together so one run names them all. It refuses a table that is not the
 * community's, a key outside the allow-list (so nothing can reach a cell by accident), a cell whose
 * `enoughData` disagrees with `minimumMatches`, and a cell flagged as having enough data without a
 * win rate and pick rate. A season with no hero, or no match at all, is valid.
 */
function readHeroStatsTable(data: unknown): ReadHeroStats {
  if (isRecord(data) && data['provenance'] !== COMMUNITY_PROVENANCE) {
    return { problems: [`provenance must be "${COMMUNITY_PROVENANCE}"`] };
  }

  if (!isRecord(data) || !Array.isArray(data['seasons']) || data['seasons'].length === 0) {
    return { problems: ['expected an object with a non-empty seasons list'] };
  }

  const problems: string[] = [];
  const checkKeys = keyChecker(problems);

  checkKeys(data, HERO_STATS_KEYS, 'the file');

  const minimumMatches = data['minimumMatches'];
  const currentSeasonId = data['currentSeasonId'];

  if (!isPositiveInteger(minimumMatches)) {
    problems.push('minimumMatches must be a whole number above 0');
  }

  const heroes = new Set<number>();
  const seasonIds = new Set<number>();
  const seasons: Record<string, unknown>[] = [];

  data['seasons'].forEach((season: unknown, index: number) => {
    if (!isRecord(season) || !isInteger(season['id']) || !isNonEmptyString(season['label'])) {
      problems.push(`season ${index} needs an integer id and a label`);
      return;
    }

    const id = season['id'];
    const where = `season ${id}`;
    const cells = season['heroes'];

    checkKeys(season, HERO_STATS_SEASON_KEYS, where);

    if (seasonIds.has(id)) {
      problems.push(`${where} is listed more than once`);
    }
    seasonIds.add(id);

    if (!isInteger(season['decidedMatches']) || Number(season['decidedMatches']) < 0) {
      problems.push(`${where} needs decidedMatches to be a non-negative whole number`);
    }

    for (const key of ['startTime', 'endTime']) {
      if (season[key] !== undefined && !isNonEmptyString(season[key])) {
        problems.push(`${where} needs ${key} to be a string when present`);
      }
    }

    if (!Array.isArray(cells)) {
      problems.push(`${where} needs a heroes list`);
      return;
    }

    const seen = new Set<number>();
    const rows = cells.flatMap((cell: unknown, position: number) => {
      const row = readHeroStatsCell(cell, minimumMatches, `${where} hero ${position}`, checkKeys, problems);

      if (!row) {
        return [];
      }

      if (seen.has(row.heroId)) {
        problems.push(`${where} lists heroId ${row.heroId} more than once`);
      }
      seen.add(row.heroId);
      heroes.add(row.heroId);

      return [row];
    });

    seasons.push({
      id,
      label: season['label'],
      ...(season['startTime'] === undefined ? {} : { startTime: season['startTime'] }),
      ...(season['endTime'] === undefined ? {} : { endTime: season['endTime'] }),
      decidedMatches: season['decidedMatches'],
      heroes: rows.sort((a, b) => a.heroId - b.heroId),
    });
  });

  if (!isInteger(currentSeasonId) || !seasonIds.has(currentSeasonId)) {
    problems.push(`currentSeasonId ${String(currentSeasonId)} is not one of the listed seasons`);
  }

  if (problems.length > 0 || !isPositiveInteger(minimumMatches) || !isInteger(currentSeasonId)) {
    return { problems };
  }

  return {
    problems,
    heroes,
    table: { provenance: COMMUNITY_PROVENANCE, minimumMatches, currentSeasonId, seasons },
  };
}

// One cell, cut to the allow-listed keys with rates to two decimals; a fault goes to `problems`.
function readHeroStatsCell(
  cell: unknown,
  minimumMatches: unknown,
  where: string,
  checkKeys: (record: Record<string, unknown>, allowed: readonly string[], where: string) => void,
  problems: string[],
): ({ heroId: number } & Record<string, unknown>) | undefined {
  if (!isRecord(cell) || !isInteger(cell['heroId'])) {
    problems.push(`${where} needs an integer heroId`);
    return undefined;
  }

  checkKeys(cell, HERO_STATS_CELL_KEYS, where);

  const { heroId, appearances, enoughData } = cell;

  if (!isInteger(appearances) || Number(appearances) < 0 || typeof enoughData !== 'boolean') {
    problems.push(`${where} needs appearances as a non-negative whole number and enoughData as true or false`);
    return undefined;
  }

  const rates: Record<string, number | null> = {};
  const unreadable: string[] = [];

  for (const key of HERO_STATS_RATE_KEYS) {
    const value = cell[key];

    if (value === null) {
      rates[key] = null;
    } else if (isFiniteNumber(value) && value >= 0) {
      rates[key] = roundToHundredths(value);
    } else {
      unreadable.push(key);
    }
  }

  if (unreadable.length > 0) {
    problems.push(`${where} needs ${unreadable.join(', ')} to be a number of 0 or more, or null`);
    return undefined;
  }

  if (isPositiveInteger(minimumMatches) && enoughData !== Number(appearances) >= minimumMatches) {
    problems.push(`${where} says enoughData ${enoughData} with ${appearances} appearances and a minimum of ${minimumMatches}`);
  }

  if (enoughData && (rates['winRate'] === null || rates['pickRate'] === null)) {
    problems.push(`${where} has enough data but no winRate and pickRate`);
  }

  return { heroId, appearances, enoughData, ...rates };
}

function describeHeroStatsProblem(data: unknown): string | undefined {
  const { problems } = readHeroStatsTable(data);

  return problems.length > 0 ? problems.join('; ') : undefined;
}

/**
 * The inputs with hero-stats replaced by its published form (allow-listed keys, rounded, cells by
 * hero id), plus a warning for each hero id that no hero in heroes.json has as its `gameId`: it is
 * published all the same, because a new hero reaches the stats before its id reaches the map.
 * Expects inputs that already passed `findProblems`.
 */
function withPublishableHeroStats(inputs: readonly PulseAtlasInput[]): { inputs: PulseAtlasInput[]; warnings: string[] } {
  const input = inputs.find((candidate) => candidate.dataset === 'hero-stats');
  const { table, heroes } = input ? readHeroStatsTable(input.data) : { table: undefined, heroes: undefined };

  if (!input || !table || !heroes) {
    return { inputs: [...inputs], warnings: [] };
  }

  return {
    inputs: inputs.map((candidate) => (candidate === input ? { ...candidate, data: table } : candidate)),
    warnings: describeUnknownHeroes(heroes, inputs.find((candidate) => candidate.dataset === 'heroes')?.data),
  };
}

// Read-back check of the written file: it keeps the marker the overlay needs.
/** The datasets built from the community's own matches, whose written file must carry the provenance marker. */
const COMMUNITY_DATASETS: readonly PulseAtlasDataset[] = ['hero-stats', 'community-stats', 'hero-scores', 'team-lineups'];

// Read-back check of a written community file: it keeps the marker the overlay needs. A dataset the
// run left out has no file and nothing to check.
function findProvenanceFileProblems(files: readonly PulseAtlasFile[], dataset: PulseAtlasDataset): string[] {
  const file = files.find((candidate) => candidate.path === datasetPath(dataset));

  if (!file) {
    return [];
  }

  const data = parseEnvelope(file.content)?.data;

  return isRecord(data) && data['provenance'] === COMMUNITY_PROVENANCE
    ? []
    : [`${dataset}: the file does not carry provenance "${COMMUNITY_PROVENANCE}"`];
}

/** A checker that records, in `problems`, each key of a record that is not in its allow-list. */
function keyChecker(problems: string[]): CheckKeys {
  return (record, allowed, where) => {
    const stray = Object.keys(record).filter((key) => !allowed.includes(key));

    if (stray.length > 0) {
      problems.push(`${where} has a key outside the allow-list: ${stray.join(', ')}`);
    }
  };
}

/**
 * A half-season of a community API answer, as its id and label; null passes through (no previous
 * half-season). Anything else that is not an id and a label is the caller's `problem`.
 */
function communityHalfSeasonOf(value: unknown, problem: (detail: string) => Error): { id: number; label: string } | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value) || !isFiniteNumber(value['id']) || !isNonEmptyString(value['label'])) {
    throw problem('a half-season needs an id and a label');
  }

  return { id: value['id'], label: value['label'] };
}

/** The keys a community-stats file, season, band and row may carry: the allow-list. Anything else refuses the build. */
const COMMUNITY_STATS_KEYS: readonly string[] = [
  'provenance',
  'minimumMatches',
  'minimumPlayers',
  'priorMatches',
  'currentSeasonId',
  'season',
  'inPlaceOfSeasonId',
  'bands',
];
const COMMUNITY_STATS_SEASON_KEYS: readonly string[] = ['id', 'label'];
const COMMUNITY_STATS_BAND_KEYS: readonly string[] = ['key', 'label', 'decidedMatches', 'heroes', 'counters', 'synergies'];
const COMMUNITY_STATS_HERO_KEYS = ['heroId', 'appearances', 'wins'] as const;
const COMMUNITY_STATS_COUNTER_KEYS = ['heroId', 'enemyHeroId', 'matches', 'appearances', 'wins'] as const;
const COMMUNITY_STATS_SYNERGY_KEYS = ['heroId', 'allyHeroId', 'matches', 'appearances', 'wins'] as const;

/** The band every reader needs: all ranks together. Rank bands may follow it; this one is always there. */
const COMMUNITY_STATS_ALL_BAND = 'all';

type CommunityRow = Record<string, number>;
type CheckKeys = (record: Record<string, unknown>, allowed: readonly string[], where: string) => void;

interface ReadCommunityStats {
  /** Faults in the data; empty when `table` is set. */
  problems: string[];
  /** The data as it is published: only allow-listed keys, rows ordered by hero id. */
  table?: Record<string, unknown>;
  /** Every hero id that has a row anywhere. */
  heroes?: Set<number>;
}

/**
 * Folds the `/api/hero-pairs` answer into the `community-stats` dataset the gate checks. The API
 * already speaks game hero ids (Deadpool under his base id) and counts only; what changes here is
 * the season: ids become twice the half-season number, as in the tier list, and `inPlaceOfSeasonId`
 * names the current half-season when the previous one stands in for it. Throws when the answer is
 * not that shape, or names no half-season yet, so the caller can fall back to the last published file.
 */
export function assembleCommunityStats(answer: unknown): unknown {
  const problem = (detail: string): Error =>
    new Error(`/api/hero-pairs is not the hero-pairs shape (${detail}). Has the web app been deployed with it?`);
  const halfSeasonOf = (value: unknown): { id: number; label: string } | null => communityHalfSeasonOf(value, problem);

  if (
    !isRecord(answer) ||
    !isFiniteNumber(answer['minimumMatches']) ||
    !isFiniteNumber(answer['priorMatches']) ||
    !Array.isArray(answer['bands'])
  ) {
    throw problem('no minimumMatches, priorMatches and bands');
  }

  const shown = halfSeasonOf(answer['halfSeason']);
  const inPlaceOf = halfSeasonOf(answer['inPlaceOf']);
  const current = inPlaceOf ?? shown;

  if (!current) {
    throw new Error('The hero-pairs API has no half-season yet, so there is nothing to publish.');
  }

  return {
    provenance: COMMUNITY_PROVENANCE,
    minimumMatches: answer['minimumMatches'],
    minimumPlayers: COMMUNITY_BUCKET_MIN_PLAYERS,
    priorMatches: answer['priorMatches'],
    currentSeasonId: seasonIdOf(current.id),
    season: shown === null ? null : { id: seasonIdOf(shown.id), label: shown.label },
    ...(inPlaceOf === null ? {} : { inPlaceOfSeasonId: seasonIdOf(inPlaceOf.id) }),
    bands: answer['bands'],
  };
}

/**
 * Checks the community-stats dataset and, when it is sound, returns it cut down to what is
 * published. Faults are reported together so one run names them all. It refuses a file that is not
 * the community's, a key outside the allow-list (so nothing can reach a row by accident), a pair
 * below `minimumMatches`, a hero paired with itself, a synergy not listed once with the lower hero
 * id first, and a missing `all` band. A band with no pair at all is valid.
 */
function readCommunityStats(data: unknown): ReadCommunityStats {
  if (isRecord(data) && data['provenance'] !== COMMUNITY_PROVENANCE) {
    return { problems: [`provenance must be "${COMMUNITY_PROVENANCE}"`] };
  }

  if (!isRecord(data) || !Array.isArray(data['bands']) || data['bands'].length === 0) {
    return { problems: ['expected an object with a non-empty bands list'] };
  }

  const problems: string[] = [];
  const checkKeys = keyChecker(problems);

  checkKeys(data, COMMUNITY_STATS_KEYS, 'the file');

  const { minimumMatches, minimumPlayers, priorMatches, currentSeasonId, season, inPlaceOfSeasonId } = data;

  if (!isPositiveInteger(minimumMatches)) {
    problems.push('minimumMatches must be a whole number above 0');
  }

  if (minimumPlayers !== undefined && !isPositiveInteger(minimumPlayers)) {
    problems.push('minimumPlayers must be a whole number above 0');
  }

  if (!isPositiveInteger(priorMatches)) {
    problems.push('priorMatches must be a whole number above 0');
  }

  if (!isInteger(currentSeasonId)) {
    problems.push('currentSeasonId must be a whole number');
  }

  if (inPlaceOfSeasonId !== undefined && inPlaceOfSeasonId !== currentSeasonId) {
    problems.push('inPlaceOfSeasonId must be the currentSeasonId when present');
  }

  const shownSeason = readCommunityStatsSeason(season, currentSeasonId, inPlaceOfSeasonId !== undefined, checkKeys, problems);
  const heroes = new Set<number>();
  const keys = new Set<string>();
  const bands = data['bands'].flatMap((band: unknown, index: number): Record<string, unknown>[] => {
    if (!isRecord(band) || !isNonEmptyString(band['key']) || !isNonEmptyString(band['label'])) {
      problems.push(`band ${index} needs a key and a label`);
      return [];
    }

    const where = `band ${band['key']}`;

    if (keys.has(band['key'])) {
      problems.push(`${where} is listed more than once`);
    }
    keys.add(band['key']);
    checkKeys(band, COMMUNITY_STATS_BAND_KEYS, where);

    if (!isInteger(band['decidedMatches']) || Number(band['decidedMatches']) < 0) {
      problems.push(`${where} needs decidedMatches to be a non-negative whole number`);
    }

    const read = (list: unknown, rowKeys: readonly string[], name: string, otherKey?: string): CommunityRow[] => {
      const rows = readCommunityRows(list, rowKeys, `${where} ${name}`, checkKeys, problems);

      for (const row of rows) {
        rowKeys.slice(0, otherKey === undefined ? 1 : 2).forEach((key) => heroes.add(row[key]));

        if (otherKey !== undefined) {
          checkCommunityPair(row, otherKey, minimumMatches, `${where} ${name}`, name === 'synergies', problems);
        }
      }

      return rows;
    };

    return [
      {
        key: band['key'],
        label: band['label'],
        decidedMatches: band['decidedMatches'],
        heroes: read(band['heroes'], COMMUNITY_STATS_HERO_KEYS, 'heroes'),
        counters: read(band['counters'], COMMUNITY_STATS_COUNTER_KEYS, 'counters', 'enemyHeroId'),
        synergies: read(band['synergies'], COMMUNITY_STATS_SYNERGY_KEYS, 'synergies', 'allyHeroId'),
      },
    ];
  });

  if (!keys.has(COMMUNITY_STATS_ALL_BAND)) {
    problems.push(`there is no "${COMMUNITY_STATS_ALL_BAND}" band`);
  }

  if (problems.length > 0 || !isPositiveInteger(minimumMatches) || !isPositiveInteger(priorMatches) || !isInteger(currentSeasonId)) {
    return { problems };
  }

  return {
    problems,
    heroes,
    table: {
      provenance: COMMUNITY_PROVENANCE,
      minimumMatches,
      ...(minimumPlayers === undefined ? {} : { minimumPlayers }),
      priorMatches,
      currentSeasonId,
      season: shownSeason,
      ...(inPlaceOfSeasonId === undefined ? {} : { inPlaceOfSeasonId }),
      bands,
    },
  };
}

// The season the counts come from, or null when the file names none. It is the current season,
// unless the file says another one stands in for it.
function readCommunityStatsSeason(
  season: unknown,
  currentSeasonId: unknown,
  standsIn: boolean,
  checkKeys: CheckKeys,
  problems: string[],
): { id: number; label: string } | null {
  if (season === null) {
    return null;
  }

  if (!isRecord(season) || !isInteger(season['id']) || !isNonEmptyString(season['label'])) {
    problems.push('season must be null or hold an integer id and a label');
    return null;
  }

  checkKeys(season, COMMUNITY_STATS_SEASON_KEYS, 'season');

  if (standsIn ? season['id'] === currentSeasonId : season['id'] !== currentSeasonId) {
    problems.push('season must be the current season, or another one when inPlaceOfSeasonId is set');
  }

  return { id: season['id'], label: season['label'] };
}

// The rows of one list, cut to the allow-listed keys and ordered by their first two keys (the hero
// ids); a fault goes to `problems`. A row listed twice is reported and kept once.
function readCommunityRows(
  list: unknown,
  keys: readonly string[],
  where: string,
  checkKeys: CheckKeys,
  problems: string[],
): CommunityRow[] {
  if (!Array.isArray(list)) {
    problems.push(`${where} needs a list`);
    return [];
  }

  const ids = keys.filter((key) => key.endsWith('HeroId') || key === 'heroId');
  const seen = new Set<string>();
  const rows = list.flatMap((item: unknown, position: number): CommunityRow[] => {
    if (!isRecord(item)) {
      problems.push(`${where} item ${position} is not an object`);
      return [];
    }

    checkKeys(item, keys, `${where} item ${position}`);

    const row: CommunityRow = {};

    for (const key of keys) {
      const value = item[key];

      if (!isInteger(value) || Number(value) < 0) {
        problems.push(`${where} item ${position} needs ${key} to be a non-negative whole number`);
        return [];
      }

      row[key] = Number(value);
    }

    const id = ids.map((key) => row[key]).join(' and ');

    if (seen.has(id)) {
      problems.push(`${where} lists ${id} more than once`);
      return [];
    }
    seen.add(id);

    if (row['wins'] > row['appearances']) {
      problems.push(`${where} item ${position} has more wins than appearances`);
    }

    return [row];
  });

  return rows.sort((a, b) => ids.reduce((order, key) => order || a[key] - b[key], 0));
}

// A pair is two different heroes with at least the minimum number of matches; a synergy is listed
// once, with the lower hero id first.
function checkCommunityPair(
  row: CommunityRow,
  otherKey: string,
  minimumMatches: unknown,
  where: string,
  isSynergy: boolean,
  problems: string[],
): void {
  if (row['heroId'] === row[otherKey]) {
    problems.push(`${where} pairs hero ${row['heroId']} with itself`);
  }

  if (isPositiveInteger(minimumMatches) && row['matches'] < minimumMatches) {
    problems.push(`${where} lists ${row['heroId']} and ${row[otherKey]} with ${row['matches']} matches, below the minimum of ${minimumMatches}`);
  }

  if (isSynergy && row['heroId'] > row[otherKey]) {
    problems.push(`${where} lists ${row['heroId']} with ${row[otherKey]}, not once with the lower id first`);
  }
}

function describeCommunityStatsProblem(data: unknown): string | undefined {
  const { problems } = readCommunityStats(data);

  return problems.length > 0 ? problems.join('; ') : undefined;
}

/**
 * The gate a community-stats input must pass to be published: its shape and, as `findProblems` does
 * for every dataset, nothing private in a key and no credential-like value in a string. Checked
 * here as well so a fallback is chosen before the build, not by the build failing.
 */
function describeCommunityStatsInputProblem(data: unknown): string | undefined {
  const problems = [
    ...(describeCommunityStatsProblem(data)?.split('; ') ?? []),
    ...findUnsafeContent(data, 'community-stats', PRIVATE_KEY),
  ];

  return problems.length > 0 ? problems.join('; ') : undefined;
}

/**
 * The inputs with community-stats replaced by its published form (allow-listed keys, rows by hero
 * id), plus a warning for each hero id that no hero in heroes.json has as its `gameId`: it is
 * published all the same, because a new hero reaches the counts before its id reaches the map. A
 * run without the dataset has nothing to replace. Expects inputs that already passed `findProblems`.
 */
function withPublishableCommunityStats(inputs: readonly PulseAtlasInput[]): { inputs: PulseAtlasInput[]; warnings: string[] } {
  const input = inputs.find((candidate) => candidate.dataset === 'community-stats');
  const { table, heroes } = input ? readCommunityStats(input.data) : { table: undefined, heroes: undefined };

  if (!input || !table || !heroes) {
    return { inputs: [...inputs], warnings: [] };
  }

  return {
    inputs: inputs.map((candidate) => (candidate === input ? { ...candidate, data: table } : candidate)),
    warnings: describeUnknownHeroes(heroes, inputs.find((candidate) => candidate.dataset === 'heroes')?.data),
  };
}

interface ResolveCommunityStatsOptions {
  /** Reads the API answer. A failure to do so, or an unusable answer, takes the fallback. */
  read: () => Promise<unknown>;
  /** What is published right now. */
  published: readonly PulseAtlasFile[];
  /** The envelope's provenance label for a freshly built file. */
  source: string;
  warn: (warning: string) => void;
}

/**
 * The input for a dataset whose failure can never fail the publish: the data from the API when it
 * answers with something that passes the gate; otherwise the last published file, as it is (bytes
 * and hash unchanged); and only when none was ever published, or the published one no longer passes
 * the gate, no input at all, so the run leaves the dataset out. Each fallback is reported through
 * `warn`. These datasets depend on an endpoint and a database function that are deployed apart from
 * this repository's push to the default branch, so a run can come before them.
 */
async function resolveOptionalDataset(
  dataset: PulseAtlasDataset,
  assemble: (answer: unknown) => unknown,
  describeProblem: (data: unknown) => string | undefined,
  { read, published, source, warn }: ResolveCommunityStatsOptions,
): Promise<PulseAtlasInput | undefined> {
  try {
    const data = assemble(await read());
    const problem = describeProblem(data);

    if (problem === undefined) {
      return { dataset, source, data };
    }

    throw new Error(problem);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const file = published.find((candidate) => candidate.path === datasetPath(dataset));
    const envelope = file ? parseEnvelope(file.content) : undefined;

    if (envelope && describeProblem(envelope.data) === undefined) {
      warn(`${dataset} could not be built (${reason}); the last published file is kept as it is`);
      return { dataset, source: envelope.source, data: envelope.data };
    }

    warn(
      `${dataset} could not be built (${reason}) and ${file ? 'the published file is unusable' : 'none was ever published'}; it is left out of this publish`,
    );
    return undefined;
  }
}

/** The community-stats input for a run; see `resolveOptionalDataset`. The gate is the shape check plus the private-key and credential-value checks. */
export function resolveCommunityStats(options: ResolveCommunityStatsOptions): Promise<PulseAtlasInput | undefined> {
  return resolveOptionalDataset('community-stats', assembleCommunityStats, describeCommunityStatsInputProblem, options);
}

/** The hero-scores input for a run; see `resolveOptionalDataset`. */
export function resolveHeroScores(
  options: ResolveCommunityStatsOptions & { heroGameIds: unknown },
): Promise<PulseAtlasInput | undefined> {
  return resolveOptionalDataset(
    'hero-scores',
    (answer) => assembleHeroScores(answer, options.heroGameIds, options.warn),
    describeHeroScoresInputProblem,
    options,
  );
}

const HERO_SCORE_STATS = ['damage', 'sustain', 'ultimate', 'utility'] as const;

/** The keys a hero-scores file, hero, stat and ability may carry: the allow-list. Anything else refuses the build. */
const HERO_SCORES_KEYS: readonly string[] = [
  'provenance',
  'minimums',
  'qualifiedHeroes',
  'currentSeasonId',
  'season',
  'inPlaceOfSeasonId',
  'heroes',
];
const HERO_SCORES_MINIMUM_KEYS: readonly string[] = ['matches', 'contributors', 'busiestContributorShare', 'rankedHeroes'];
const HERO_SCORES_HERO_KEYS: readonly string[] = ['heroId', ...HERO_SCORE_STATS, 'abilities'];
const HERO_SCORES_STAT_KEYS: readonly string[] = ['status', 'score', 'label', 'matches', 'contributors', 'oneContributorAboveHalf', 'measures'];
const HERO_SCORES_ABILITY_KEYS: readonly string[] = ['slot', 'ability', 'alsoIncludes', 'tag', 'usesPerTenMinutes', 'takedownsPerUse', 'matches'];
const HERO_SCORES_STATUSES: readonly unknown[] = ['scored', 'collecting', 'ranking-too-small', 'no-measurable-ability'];
/** The statuses of a hero that passes the rule, whether or not enough heroes do for a ranking. */
const HERO_SCORE_QUALIFIED_STATUSES: readonly unknown[] = ['scored', 'ranking-too-small'];
/** An exact count below the rule could be one person's own games on a hero, so the file refuses one. */
const HERO_SCORE_PROGRESS_STEP = 5;
const HERO_SCORE_TAGS: readonly unknown[] = ['Utility', 'Damage', 'Mobility', 'Sustain', null];
/** Utility and Ultimate stay estimates: the game shows that an ability was used, not whether it landed. */
const HERO_SCORE_LABELS: Readonly<Record<(typeof HERO_SCORE_STATS)[number], string>> = {
  damage: 'measured',
  sustain: 'measured',
  ultimate: 'estimated',
  utility: 'estimated',
};
const HERO_SCORE_MEASURES: Readonly<Record<(typeof HERO_SCORE_STATS)[number], readonly string[]>> = {
  damage: ['damagePerMinute'],
  sustain: ['healingPerMinute', 'blockedPerMinute', 'sustainPerMinute'],
  ultimate: ['usesPerTenMinutes', 'takedownsPerUse'],
  utility: ['useOfAvailable', 'takedownsPerUse'],
};

/**
 * Folds the `/api/community/hero-scores` answer into the `hero-scores` dataset the gate checks: hero
 * slugs become the game's numeric ids (a hero without an entry is left out, with a warning) and
 * half-seasons become season ids, as in the tier list. Throws when the answer is not that shape, or
 * names no half-season yet, so the caller can fall back to the last published file.
 */
export function assembleHeroScores(answer: unknown, heroGameIds: unknown, warn: (warning: string) => void = () => undefined): unknown {
  const problem = (detail: string): Error =>
    new Error(`/api/community/hero-scores is not the hero-scores shape (${detail}). Has the web app been deployed with it?`);
  const halfSeasonOf = (value: unknown): { id: number; label: string } | null => communityHalfSeasonOf(value, problem);

  if (!isRecord(answer) || !isRecord(answer['minimums']) || !Array.isArray(answer['heroes'])) {
    throw problem('no minimums and heroes');
  }

  const shown = halfSeasonOf(answer['halfSeason']);
  const inPlaceOf = halfSeasonOf(answer['inPlaceOf']);
  const current = inPlaceOf ?? shown;

  if (!current || !shown) {
    throw new Error('The hero-scores API has no half-season yet, so there is nothing to publish.');
  }

  const { gameIdOf, unmapped } = heroGameIdLookup(heroGameIds);
  const qualifiedHeroes = { damage: 0, sustain: 0, ultimate: 0, utility: 0 };
  const heroes = answer['heroes'].flatMap((row: unknown) => {
    if (!isRecord(row) || !isNonEmptyString(row['hero'])) {
      throw problem('a hero needs an id');
    }

    const { hero, ...rest } = row;
    const heroId = gameIdOf(String(hero));

    for (const name of HERO_SCORE_STATS) {
      const stat = rest[name];

      if (isRecord(stat) && HERO_SCORE_QUALIFIED_STATUSES.includes(stat['status'])) {
        qualifiedHeroes[name] += 1;
      }
    }

    return heroId === undefined ? [] : [{ heroId, ...rest }];
  });

  unmapped.forEach((hero) => warn(`${hero}: no gameId in hero-game-ids.json, so the hero is left out of hero-scores`));

  return {
    provenance: COMMUNITY_PROVENANCE,
    minimums: answer['minimums'],
    qualifiedHeroes,
    currentSeasonId: seasonIdOf(current.id),
    season: { id: seasonIdOf(shown.id), label: shown.label },
    ...(inPlaceOf === null ? {} : { inPlaceOfSeasonId: seasonIdOf(inPlaceOf.id) }),
    heroes,
  };
}

interface ReadHeroScores {
  /** Faults in the data; empty when `table` is set. */
  problems: string[];
  /** The data as it is published: heroes ordered by id. */
  table?: Record<string, unknown>;
  /** Every hero id that has a row. */
  heroes?: Set<number>;
}

// One stat's faults. A score can only be there with enough matches behind it and with the fixed
// label, and a hero below the rule can carry no figure.
function findHeroScoreStatProblems(
  stat: unknown,
  name: (typeof HERO_SCORE_STATS)[number],
  minimumMatches: unknown,
  where: string,
  checkKeys: CheckKeys,
): string[] {
  if (!isRecord(stat)) {
    return [`${where} is not an object`];
  }

  const found: string[] = [];
  const { status, score, label, matches, contributors, oneContributorAboveHalf, measures } = stat;

  checkKeys(stat, HERO_SCORES_STAT_KEYS, where);

  if (!HERO_SCORES_STATUSES.includes(status)) {
    found.push(`${where} has an unknown status`);
  }

  if (label !== HERO_SCORE_LABELS[name]) {
    found.push(`${where} must be labelled ${HERO_SCORE_LABELS[name]}`);
  }

  if (!isInteger(matches) || matches < 0) {
    found.push(`${where} needs matches as a non-negative whole number`);
  }

  if (status === 'scored') {
    if (!isInteger(score) || score < 1 || score > 10) {
      found.push(`${where} needs a score that is a whole number from 1 to 10`);
    }

    if (!isFiniteNumber(minimumMatches) || !isInteger(matches) || matches < minimumMatches) {
      found.push(`${where} has a score with fewer than the minimum matches`);
    }
  } else if (score !== null) {
    found.push(`${where} has a score but its status is ${String(status)}`);
  }

  if (status === 'collecting') {
    if (!isInteger(contributors) || contributors < 0 || typeof oneContributorAboveHalf !== 'boolean') {
      found.push(`${where} needs contributors and oneContributorAboveHalf while collecting`);
    }

    if (isInteger(matches) && matches % HERO_SCORE_PROGRESS_STEP !== 0) {
      found.push(`${where} may show matches only in steps of ${HERO_SCORE_PROGRESS_STEP} while collecting`);
    }
  } else if (contributors !== null || oneContributorAboveHalf !== null) {
    found.push(`${where} may name contributors only while collecting`);
  }

  if (status === 'scored' || status === 'ranking-too-small') {
    if (!isRecord(measures)) {
      found.push(`${where} needs its measures`);
    } else {
      checkKeys(measures, HERO_SCORE_MEASURES[name], `${where} measures`);

      if (!Object.values(measures).every((value) => isFiniteNumber(value) && value >= 0)) {
        found.push(`${where} needs every measure to be a number of 0 or more`);
      }
    }
  } else if (measures !== null) {
    found.push(`${where} may carry no measures before it passes the rule`);
  }

  return found;
}

function findHeroScoreAbilityProblems(ability: unknown, where: string, checkKeys: CheckKeys): string[] {
  if (!isRecord(ability)) {
    return [`${where} is not an object`];
  }

  checkKeys(ability, HERO_SCORES_ABILITY_KEYS, where);

  const { slot, ability: name, alsoIncludes, tag, usesPerTenMinutes, takedownsPerUse, matches } = ability;
  // An answer from a web app deployed before alsoIncludes existed has none, and neither does a file
  // published before it, which a failed run keeps as the last good file.
  const valid =
    isNonEmptyString(slot) &&
    isNullableString(name) &&
    (alsoIncludes === undefined || (Array.isArray(alsoIncludes) && alsoIncludes.every(isNonEmptyString))) &&
    HERO_SCORE_TAGS.includes(tag) &&
    isFiniteNumber(usesPerTenMinutes) &&
    usesPerTenMinutes >= 0 &&
    (takedownsPerUse === null || (isFiniteNumber(takedownsPerUse) && takedownsPerUse >= 0)) &&
    isInteger(matches) &&
    matches >= 0;

  return valid ? [] : [`${where} is not a slot, ability, alsoIncludes, tag, usesPerTenMinutes, takedownsPerUse and matches`];
}

/**
 * Checks the hero-scores dataset and, when it is sound, returns it with heroes in id order. Faults are
 * reported together so one run names them all. It refuses a file that is not the community's, a key
 * outside the allow-list (so nothing can reach a row by accident), a score below the minimum matches
 * and a hero below the rule that carries a figure. No hero at all is valid: that is the launch state.
 */
function readHeroScores(data: unknown): ReadHeroScores {
  if (isRecord(data) && data['provenance'] !== COMMUNITY_PROVENANCE) {
    return { problems: [`provenance must be "${COMMUNITY_PROVENANCE}"`] };
  }

  if (!isRecord(data) || !isRecord(data['minimums']) || !Array.isArray(data['heroes'])) {
    return { problems: ['expected an object with minimums and a heroes list'] };
  }

  const problems: string[] = [];
  const checkKeys = keyChecker(problems);
  const minimums = data['minimums'];
  const season = data['season'];

  checkKeys(data, HERO_SCORES_KEYS, 'the file');
  checkKeys(minimums, HERO_SCORES_MINIMUM_KEYS, 'minimums');

  if (!HERO_SCORES_MINIMUM_KEYS.every((key) => isFiniteNumber(minimums[key]))) {
    problems.push('minimums needs its four numbers');
  }

  const qualifiedHeroes = data['qualifiedHeroes'];

  if (qualifiedHeroes !== undefined) {
    if (!isRecord(qualifiedHeroes)) {
      problems.push('qualifiedHeroes must be an object');
    } else {
      checkKeys(qualifiedHeroes, HERO_SCORE_STATS, 'qualifiedHeroes');

      const counts = HERO_SCORE_STATS.map((name) => qualifiedHeroes[name]);

      if (!counts.every((count) => isInteger(count) && count >= 0)) {
        problems.push('qualifiedHeroes needs a non-negative whole number for each stat');
      }
    }
  }

  if (!isInteger(data['currentSeasonId'])) {
    problems.push('currentSeasonId must be a whole number');
  }

  if (data['inPlaceOfSeasonId'] !== undefined && data['inPlaceOfSeasonId'] !== data['currentSeasonId']) {
    problems.push('inPlaceOfSeasonId must be the currentSeasonId when present');
  }

  if (!isRecord(season) || !isInteger(season['id']) || !isNonEmptyString(season['label'])) {
    problems.push('season needs an id and a label');
  } else {
    checkKeys(season, COMMUNITY_STATS_SEASON_KEYS, 'season');
  }

  const heroes = new Set<number>();

  data['heroes'].forEach((row: unknown, index: number) => {
    if (!isRecord(row) || !isInteger(row['heroId'])) {
      problems.push(`hero ${index} needs an integer heroId`);
      return;
    }

    const heroId = row['heroId'];
    const where = `hero ${heroId}`;

    if (heroes.has(heroId)) {
      problems.push(`${where} is listed more than once`);
    }
    heroes.add(heroId);
    checkKeys(row, HERO_SCORES_HERO_KEYS, where);

    for (const name of HERO_SCORE_STATS) {
      problems.push(...findHeroScoreStatProblems(row[name], name, minimums['matches'], `${where} ${name}`, checkKeys));
    }

    const abilities = row['abilities'];

    if (!Array.isArray(abilities)) {
      problems.push(`${where} needs an abilities list`);
    } else {
      abilities.forEach((ability: unknown, position: number) => {
        problems.push(...findHeroScoreAbilityProblems(ability, `${where} ability ${position}`, checkKeys));
      });
    }
  });

  if (problems.length > 0) {
    return { problems };
  }

  const ordered = [...data['heroes']].sort((a, b) => Number(a['heroId']) - Number(b['heroId']));

  return { problems, heroes, table: { ...data, heroes: ordered } };
}

/** The gate a hero-scores input must pass, checked before the build so a fallback can be chosen. */
function describeHeroScoresInputProblem(data: unknown): string | undefined {
  const problems = [...readHeroScores(data).problems, ...findUnsafeContent(data, 'hero-scores')];

  return problems.length > 0 ? problems.join('; ') : undefined;
}

/**
 * The inputs with hero-scores in its published order, plus a warning for each hero id that no hero
 * in heroes.json has as its `gameId`. A run without the dataset has nothing to replace.
 */
function withPublishableHeroScores(inputs: readonly PulseAtlasInput[]): { inputs: PulseAtlasInput[]; warnings: string[] } {
  const input = inputs.find((candidate) => candidate.dataset === 'hero-scores');
  const { table, heroes } = input ? readHeroScores(input.data) : { table: undefined, heroes: undefined };

  if (!input || !table || !heroes) {
    return { inputs: [...inputs], warnings: [] };
  }

  return {
    inputs: inputs.map((candidate) => (candidate === input ? { ...candidate, data: table } : candidate)),
    warnings: describeUnknownHeroes(heroes, inputs.find((candidate) => candidate.dataset === 'heroes')?.data),
  };
}

const TEAM_LINEUPS_KEYS: readonly string[] = [
  'provenance',
  'status',
  'minimumTeams',
  'minimumPlayers',
  'mode',
  'currentSeasonId',
  'season',
  'inPlaceOfSeasonId',
  'classifiedTeams',
  'unclassifiedTeams',
  'shapes',
];
const TEAM_LINEUPS_SHAPE_KEYS: readonly string[] = ['shape', 'vanguards', 'duelists', 'strategists', 'status', 'teams', 'wins'];
const TEAM_LINEUPS_STATUSES: readonly unknown[] = ['ready', 'not-enough-data'];

/** The team-lineups input for a run; see `resolveOptionalDataset`. The gate is the shape check plus the private-key and credential-value checks. */
export function resolveTeamLineups(options: ResolveCommunityStatsOptions): Promise<PulseAtlasInput | undefined> {
  return resolveOptionalDataset('team-lineups', assembleTeamLineups, describeTeamLineupsInputProblem, options);
}

/**
 * Folds the `/api/team-lineups` answer into the `team-lineups` dataset the gate checks. Only the
 * counts are taken (teams and wins per shape, never the rates, which a reader derives), and the
 * half-season becomes a season id, as in the tier list. Throws when the answer is not that shape, or
 * names no half-season yet, so the caller can fall back to the last published file.
 */
export function assembleTeamLineups(answer: unknown): unknown {
  const problem = (detail: string): Error =>
    new Error(`/api/team-lineups is not the team-lineups shape (${detail}). Has the web app been deployed with it?`);
  const halfSeasonOf = (value: unknown): { id: number; label: string } | null => communityHalfSeasonOf(value, problem);

  if (
    !isRecord(answer) ||
    !isNonEmptyString(answer['status']) ||
    !isFiniteNumber(answer['minimumTeams']) ||
    !isNonEmptyString(answer['mode']) ||
    !isFiniteNumber(answer['classifiedTeams']) ||
    !isFiniteNumber(answer['unclassifiedTeams']) ||
    !Array.isArray(answer['shapes'])
  ) {
    throw problem('no status, minimumTeams, mode, team counts and shapes');
  }

  const shown = halfSeasonOf(answer['halfSeason']);
  const inPlaceOf = halfSeasonOf(answer['inPlaceOf']);
  const current = inPlaceOf ?? shown;

  if (!current || !shown) {
    throw new Error('The team-lineups API has no half-season yet, so there is nothing to publish.');
  }

  const shapes = answer['shapes'].map((row: unknown) => {
    if (!isRecord(row) || !isNonEmptyString(row['shape'])) {
      throw problem('a shape needs a name');
    }

    const { shape, vanguards, duelists, strategists, status, teams, wins } = row;

    return { shape, vanguards, duelists, strategists, status, teams, wins };
  });

  return {
    provenance: COMMUNITY_PROVENANCE,
    status: answer['status'],
    minimumTeams: answer['minimumTeams'],
    minimumPlayers: COMMUNITY_BUCKET_MIN_PLAYERS,
    mode: answer['mode'],
    currentSeasonId: seasonIdOf(current.id),
    season: { id: seasonIdOf(shown.id), label: shown.label },
    ...(inPlaceOf === null ? {} : { inPlaceOfSeasonId: seasonIdOf(inPlaceOf.id) }),
    classifiedTeams: answer['classifiedTeams'],
    unclassifiedTeams: answer['unclassifiedTeams'],
    shapes,
  };
}

// One shape's faults. A shape under the minimum carries only the teams counted so far, never wins, and
// a listed one has at least the minimum teams, so no figure can describe a handful of teams.
function findTeamLineupShapeProblems(row: unknown, index: number, minimumTeams: unknown, classifiedTeams: unknown): string[] {
  if (!isRecord(row)) {
    return [`shape ${index} is not an object`];
  }

  const { shape, vanguards, duelists, strategists, status, teams, wins } = row;
  const where = `shape ${String(shape)}`;
  const found: string[] = [];

  if (![vanguards, duelists, strategists].every((count) => isInteger(count) && count >= 0)) {
    return [`${where} needs vanguards, duelists and strategists as non-negative whole numbers`];
  }

  if (shape !== `${String(vanguards)}-${String(duelists)}-${String(strategists)}`) {
    found.push(`${where} does not match its vanguards, duelists and strategists`);
  }

  if (status === 'ready') {
    // The floor is the site's own rule, so an answer that reports a lowered minimum cannot publish a thin shape.
    if (!isInteger(teams) || !isFiniteNumber(minimumTeams) || teams < Math.max(minimumTeams, TEAM_LINEUP_MIN_TEAMS)) {
      found.push(`${where} is ready with fewer than the minimum teams`);
    } else if (!isInteger(wins) || wins < 0 || wins > teams) {
      found.push(`${where} needs wins as a whole number from 0 to its teams`);
    } else if (isFiniteNumber(classifiedTeams) && teams > classifiedTeams) {
      found.push(`${where} has more teams than classifiedTeams`);
    }
  } else if (status === 'not-enough-data') {
    if (wins !== null) {
      found.push(`${where} is not enough data, so it may carry no wins`);
    }

    // Null is a count the database did not give; otherwise it is the progress toward the minimum.
    if (teams !== null) {
      if (!isPositiveInteger(teams) || !isFiniteNumber(minimumTeams) || teams >= Math.max(minimumTeams, TEAM_LINEUP_MIN_TEAMS)) {
        found.push(`${where} is not enough data, so its teams must be null or a whole number under the minimum`);
      } else if (isFiniteNumber(classifiedTeams) && teams > classifiedTeams) {
        found.push(`${where} has more teams than classifiedTeams`);
      }
    }
  } else {
    found.push(`${where} has an unknown status`);
  }

  return found;
}

/**
 * Checks the team-lineups dataset and returns every fault, so one run names them all. It refuses a
 * file that is not the community's, a key outside the allow-list (so nothing can reach a row by
 * accident), counts on a shape under the minimum, and a status that disagrees with the shapes. No
 * shape at all is valid: that is the launch state.
 */
function readTeamLineups(data: unknown): string[] {
  if (isRecord(data) && data['provenance'] !== COMMUNITY_PROVENANCE) {
    return [`provenance must be "${COMMUNITY_PROVENANCE}"`];
  }

  if (!isRecord(data) || !Array.isArray(data['shapes'])) {
    return ['expected an object with a shapes list'];
  }

  const problems: string[] = [];
  const checkKeys = keyChecker(problems);
  const season = data['season'];
  const shapes: unknown[] = data['shapes'];

  checkKeys(data, TEAM_LINEUPS_KEYS, 'the file');

  if (!TEAM_LINEUPS_STATUSES.includes(data['status'])) {
    problems.push('status must be ready or not-enough-data');
  }

  if (!isInteger(data['minimumTeams']) || data['minimumTeams'] < TEAM_LINEUP_MIN_TEAMS) {
    problems.push(`minimumTeams must be a whole number of at least ${TEAM_LINEUP_MIN_TEAMS}`);
  }

  if (data['minimumPlayers'] !== undefined && !isPositiveInteger(data['minimumPlayers'])) {
    problems.push('minimumPlayers must be a whole number above 0');
  }

  if (!isNonEmptyString(data['mode'])) {
    problems.push('mode must name the mode the counts use');
  }

  if (!isInteger(data['classifiedTeams']) || data['classifiedTeams'] < 0 || !isInteger(data['unclassifiedTeams']) || data['unclassifiedTeams'] < 0) {
    problems.push('classifiedTeams and unclassifiedTeams must be non-negative whole numbers');
  }

  if (!isInteger(data['currentSeasonId'])) {
    problems.push('currentSeasonId must be a whole number');
  }

  if (data['inPlaceOfSeasonId'] !== undefined && data['inPlaceOfSeasonId'] !== data['currentSeasonId']) {
    problems.push('inPlaceOfSeasonId must be the currentSeasonId when present');
  }

  if (!isRecord(season) || !isInteger(season['id']) || !isNonEmptyString(season['label'])) {
    problems.push('season needs an id and a label');
  } else {
    checkKeys(season, COMMUNITY_STATS_SEASON_KEYS, 'season');
  }

  const names = new Set<unknown>();

  shapes.forEach((row, index) => {
    if (isRecord(row)) {
      checkKeys(row, TEAM_LINEUPS_SHAPE_KEYS, `shape ${String(row['shape'])}`);

      if (names.has(row['shape'])) {
        problems.push(`shape ${String(row['shape'])} is listed more than once`);
      }
      names.add(row['shape']);
    }

    problems.push(...findTeamLineupShapeProblems(row, index, data['minimumTeams'], data['classifiedTeams']));
  });

  const anyReady = shapes.some((row) => isRecord(row) && row['status'] === 'ready');

  if (TEAM_LINEUPS_STATUSES.includes(data['status']) && (data['status'] === 'ready') !== anyReady) {
    problems.push('status must be ready if and only if a shape is ready');
  }

  return problems;
}

/** The gate a team-lineups input must pass, checked before the build so a fallback can be chosen. */
function describeTeamLineupsInputProblem(data: unknown): string | undefined {
  const problems = [...readTeamLineups(data), ...findUnsafeContent(data, 'team-lineups')];

  return problems.length > 0 ? problems.join('; ') : undefined;
}

function findSeasonFileProblems(files: readonly PulseAtlasFile[], sha256: Sha256Hex): string[] {
  const tierListFile = files.find((file) => file.path === datasetPath('tier-list'));

  if (!tierListFile) {
    return [];
  }

  const index = parseEnvelope(tierListFile.content)?.data;
  const seasons = isRecord(index) ? index['seasons'] : undefined;

  if (!isRecord(index) || !Array.isArray(seasons)) {
    return ['tier-list: has no seasons index'];
  }

  const problems: string[] = [];

  if (index['provenance'] !== COMMUNITY_PROVENANCE) {
    problems.push(`tier-list: the index does not carry provenance "${COMMUNITY_PROVENANCE}"`);
  }

  for (const season of seasons) {
    if (!isRecord(season) || !isInteger(season['id'])) {
      problems.push('tier-list: a season in the index has no integer id');
      continue;
    }

    const id = season['id'];
    const path = tierListSeasonPath(id);
    const file = files.find((candidate) => candidate.path === path);
    const seasonData = file ? parseEnvelope(file.content)?.data : undefined;

    if (season['path'] !== path) {
      problems.push(`tier-list: season ${id} path is not ${path}`);
    } else if (!file) {
      problems.push(`tier-list: season ${id} has no file at ${path}`);
    } else if (season['sha256'] !== sha256(file.content)) {
      problems.push(`tier-list: season ${id} file does not match its hash in tier-list.json`);
    } else if (!isRecord(seasonData) || seasonData['id'] !== id || !isRecord(seasonData['ranks'])) {
      problems.push(`tier-list: season ${id} file does not hold that season's ranks`);
    } else if (seasonData['provenance'] !== COMMUNITY_PROVENANCE) {
      problems.push(`tier-list: season ${id} file does not carry provenance "${COMMUNITY_PROVENANCE}"`);
    }

    if (('ranks' in season) !== (id === index['currentSeasonId'])) {
      problems.push(`tier-list: season ${id} must have ranks in the index if and only if it is the current season`);
    }
  }

  return problems;
}

function hasTiers(snapshot: unknown): snapshot is Record<string, unknown> & { tiers: unknown[] } {
  return isRecord(snapshot) && Array.isArray(snapshot['tiers']);
}

function listsAnyHero(snapshot: unknown): boolean {
  return (
    hasTiers(snapshot) &&
    snapshot.tiers.some((tier) => isRecord(tier) && Array.isArray(tier['heroes']) && tier['heroes'].length > 0)
  );
}

function findUnsafeContent(value: unknown, path: string, unsafeKey: RegExp = UNSAFE_KEY): string[] {
  const found: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findUnsafeContent(item, `${path}[${index}]`, unsafeKey)));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (unsafeKey.test(key) && !PLAYER_COUNT_KEYS.includes(key)) {
        found.push(`${path}.${key}: key is private or counter data`);
      }

      found.push(...findUnsafeContent(child, `${path}.${key}`, unsafeKey));
    }
  } else if (typeof value === 'string' && (UNSAFE_VALUE.test(value) || RIVALS_META_NAME.test(value))) {
    found.push(`${path}: value looks like a credential or names a source that must stay private`);
  }

  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
