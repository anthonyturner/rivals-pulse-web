export const PULSE_ATLAS_SCHEMA_VERSION = 1;
export const PULSE_ATLAS_BASE_PATH = 'pulse-atlas/v1';
export const PULSE_ATLAS_DATASETS = ['heroes', 'tier-list', 'glossary', 'maps', 'hero-styles', 'hero-stats'] as const;

/**
 * Read to build `heroes.json` (each hero's numeric `gameId`) but not published as a file of its own,
 * so it is not in `PULSE_ATLAS_DATASETS` and not in the manifest.
 */
export const PULSE_ATLAS_HERO_GAME_IDS = 'hero-game-ids';

const HERO_STYLE_WEIGHTS = ['poke', 'dive', 'brawl'] as const;
const HERO_ROLES = ['Vanguard', 'Duelist', 'Strategist'] as const;
const GAME_ID_ENTRY_KEYS: readonly string[] = ['id', 'gameId', 'gameIdVariants'];

export type PulseAtlasDataset = (typeof PULSE_ATLAS_DATASETS)[number];

export type Sha256Hex = (text: string) => string;

export interface PulseAtlasInput {
  dataset: PulseAtlasDataset | typeof PULSE_ATLAS_HERO_GAME_IDS;
  /** Provenance label. Its value may change when the content source moves; the file shape never does. */
  source: string;
  data: unknown;
}

export interface PulseAtlasEnvelope {
  schemaVersion: number;
  /** When this dataset's data last changed, not when the feed last ran. */
  generatedAt: string;
  source: string;
  data: unknown;
}

export interface PulseAtlasManifestEntry {
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
// leak of something private rather than as a false alarm. `counters` are
// matchup picks derived from a third-party site and are never published.
const UNSAFE_KEY =
  /secret|password|passwd|token|api[-_]?key|authorization|credential|email|puuid|player|steam|account|session|^counters?$/i;

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

  const built = PULSE_ATLAS_DATASETS.flatMap((dataset): BuiltDataset[] => {
    const input = counted.inputs.find((candidate) => candidate.dataset === dataset);

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
  problems.push(...findHeroStatsFileProblems(files));

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas failed verification:\n- ${problems.join('\n- ')}`);
  }
}

/** The top-level `provenance` of the tier-list index and of every season file. The overlay refuses a tier-list file without it. */
export const COMMUNITY_PROVENANCE = 'rivals-pulse-community';

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

export interface HalfSeasonStats {
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
      problems.push(...findUnsafeContent(input.data, dataset));
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
    case 'hero-stats':
      return describeHeroStatsProblem(data);
  }
}

function publishedHeroIds(inputs: readonly PulseAtlasInput[]): string[] | undefined {
  const heroes = inputs.find((input) => input.dataset === 'heroes')?.data;

  // A malformed hero list is reported on its own; there is nothing to check styles against.
  return Array.isArray(heroes) && heroes.length > 0 && heroes.every((hero) => isRecord(hero) && isNonEmptyString(hero['id']))
    ? heroes.map((hero) => String(hero['id']))
    : undefined;
}

export interface HeroStyleFindings {
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

export interface HeroGameIdFindings {
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

  const { matchesCounted, belowMinimum, fallbackFromSeasonId } = snapshot;

  if (matchesCounted !== undefined && !(isFiniteNumber(matchesCounted) && matchesCounted >= 0)) {
    return 'needs matchesCounted to be a non-negative number';
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
  const checkKeys = (record: Record<string, unknown>, allowed: readonly string[], where: string): void => {
    const stray = Object.keys(record).filter((key) => !allowed.includes(key));

    if (stray.length > 0) {
      problems.push(`${where} has a key outside the allow-list: ${stray.join(', ')}`);
    }
  };

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
function findHeroStatsFileProblems(files: readonly PulseAtlasFile[]): string[] {
  const file = files.find((candidate) => candidate.path === datasetPath('hero-stats'));

  if (!file) {
    return [];
  }

  const data = parseEnvelope(file.content)?.data;

  return isRecord(data) && data['provenance'] === COMMUNITY_PROVENANCE
    ? []
    : [`hero-stats: the file does not carry provenance "${COMMUNITY_PROVENANCE}"`];
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

function findUnsafeContent(value: unknown, path: string): string[] {
  const found: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findUnsafeContent(item, `${path}[${index}]`)));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_KEY.test(key)) {
        found.push(`${path}.${key}: key is private or counter data`);
      }

      found.push(...findUnsafeContent(child, `${path}.${key}`));
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
