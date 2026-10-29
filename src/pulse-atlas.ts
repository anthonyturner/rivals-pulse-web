export const PULSE_ATLAS_SCHEMA_VERSION = 1;
export const PULSE_ATLAS_BASE_PATH = 'pulse-atlas/v1';
export const PULSE_ATLAS_DATASETS = ['heroes', 'tier-list', 'glossary', 'maps', 'hero-styles'] as const;

const HERO_STYLE_WEIGHTS = ['poke', 'dive', 'brawl'] as const;

export type PulseAtlasDataset = (typeof PULSE_ATLAS_DATASETS)[number];

export type Sha256Hex = (text: string) => string;

export interface PulseAtlasInput {
  dataset: PulseAtlasDataset;
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

  const styled = withPublishableHeroStyles(prepared);
  styled.warnings.forEach((warning) => warn(`hero-styles: ${warning}`));

  const split = withTierListSplitBySeason(styled.inputs, generatedAt, sha256, previous);
  split.warnings.forEach((warning) => warn(`tier-list: ${warning}`));

  const built = PULSE_ATLAS_DATASETS.flatMap((dataset): BuiltDataset[] => {
    const input = split.inputs.find((candidate) => candidate.dataset === dataset);

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

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas failed verification:\n- ${problems.join('\n- ')}`);
  }
}

export interface TierListRequest {
  seasonId: number;
  rank: string;
}

export interface TierListSnapshot extends TierListRequest {
  /** The `/api/tier-list?season=<seasonId>&rank=<rank>` response body. */
  response: unknown;
}

interface TierListIndex {
  currentSeasonId: unknown;
  rankFilters: unknown[];
  seasons: Record<string, unknown>[];
  seasonIds: number[];
  ranks: string[];
}

/**
 * Every season and rank the tier-list API says it has, read from its default
 * response. One snapshot has to be fetched for each pair, so the published
 * file never depends on a hard-coded list.
 */
export function tierListRequests(index: unknown): TierListRequest[] {
  const { seasonIds, ranks } = parseTierListIndex(index);

  return seasonIds.flatMap((seasonId) => ranks.map((rank) => ({ seasonId, rank })));
}

/**
 * Folds the per-season, per-rank API responses into the one published
 * tier-list shape: season details with a `ranks` map of snapshots. Throws if a
 * pair has no snapshot, or if the API answered with a different season or rank
 * than was asked for (it silently falls back to another rank when one is
 * missing). `fetchedAt` and `sourceTimestamp` are dropped because they only
 * record when a sync ran, the same for every season and new on every run, so
 * they would change every season's file without any tier list changing.
 */
export function assembleTierList(index: unknown, snapshots: readonly TierListSnapshot[]): unknown {
  const parsed = parseTierListIndex(index);
  const problems: string[] = [];

  const seasons = parsed.seasons.map((season, position) => {
    const seasonId = parsed.seasonIds[position];
    const ranks: Record<string, { tiers: unknown }> = {};

    for (const rank of parsed.ranks) {
      const found = snapshots.find((item) => item.seasonId === seasonId && item.rank === rank);
      const response = found?.response;

      if (!isRecord(response) || !Array.isArray(response['tiers'])) {
        problems.push(`season ${seasonId} rank ${rank}: no snapshot returned`);
      } else if (response['selectedSeasonId'] !== seasonId || response['selectedRankFilter'] !== rank) {
        problems.push(
          `season ${seasonId} rank ${rank}: the API answered with season ${response['selectedSeasonId']} rank ${response['selectedRankFilter']}`,
        );
      } else {
        ranks[rank] = { tiers: response['tiers'] };
      }
    }

    const { fetchedAt: _fetchedAt, sourceTimestamp: _sourceTimestamp, ...details } = season;

    return { ...details, ranks };
  });

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas could not assemble the tier list:\n- ${problems.join('\n- ')}`);
  }

  return {
    currentSeasonId: parsed.currentSeasonId,
    rankFilters: parsed.rankFilters,
    seasons,
  };
}

function parseTierListIndex(index: unknown): TierListIndex {
  if (
    !isRecord(index) ||
    !Array.isArray(index['seasons']) ||
    index['seasons'].length === 0 ||
    !Array.isArray(index['rankFilters']) ||
    index['rankFilters'].length === 0
  ) {
    throw new Error('The tier-list API did not list its seasons and rank filters.');
  }

  const seasons = index['seasons'];
  const rankFilters = index['rankFilters'];
  const seasonIds = seasons.map((season) => (isRecord(season) ? season['id'] : undefined));
  const ranks = rankFilters.map((filter) => (isRecord(filter) ? filter['value'] : undefined));

  if (!seasonIds.every((id): id is number => Number.isInteger(id)) || !ranks.every(isNonEmptyString)) {
    throw new Error('The tier-list API lists a season without an integer id or a rank without a value.');
  }

  return {
    currentSeasonId: index['currentSeasonId'],
    rankFilters,
    seasons: seasons.filter(isRecord),
    seasonIds,
    ranks,
  };
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
  if (input.dataset === 'tier-list' && isRecord(input.data)) {
    // The API names where its numbers come from; the published files never do.
    const { sourceName: _sourceName, sourceUrl: _sourceUrl, ...publicTierList } = input.data;
    return { ...input, data: publicTierList };
  }

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
  banRate: number;
  matches: number;
  wins: number;
  score: number;
}

interface SlimSnapshot {
  tiers: (Record<string, unknown> & { heroes: SlimHeroRow[] })[];
}

interface TierListSeason {
  id: number;
  /** Everything about the season except its ranks. */
  details: Record<string, unknown>;
  ranks: Record<string, SlimSnapshot>;
}

/** Who a hero row names, kept so heroes.json can be checked before the name is dropped. */
interface HeroIdentity {
  name: unknown;
  imageUrl: unknown;
}

interface ReadTierList {
  /** Faults in the data; empty when `tierList` is set. */
  problems: string[];
  tierList?: {
    currentSeasonId: number;
    rankFilters: unknown[];
    seasons: TierListSeason[];
    /** Every hero that has a row anywhere, once per game hero id. */
    heroes: Map<number, HeroIdentity>;
  };
}

/**
 * Checks the full tier list (every season and rank, as `assembleTierList`
 * returns it) and, when it is sound, cuts every hero row down to what is
 * published. Faults are reported together so one run names them all.
 */
function readTierList(data: unknown): ReadTierList {
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
  const heroes = new Map<number, HeroIdentity>();

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
      problems.push(`season ${id} lists no hero at any rank`);
      return;
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
    },
  };
}

// Reports the first row that cannot be published, as text, instead of a snapshot.
function slimSnapshot(snapshot: unknown, heroes: Map<number, HeroIdentity>): SlimSnapshot | string {
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

      if (!slim || !isRecord(row)) {
        return `tier ${tier['name']} hero ${rows.length} needs an integer heroId and numbers for winRate, pickRate, banRate, matches, wins and score`;
      }

      if (!heroes.has(slim.heroId)) {
        heroes.set(slim.heroId, { name: row['name'], imageUrl: row['imageUrl'] });
      }

      rows.push(slim);
    }

    tiers.push({ ...tier, heroes: rows });
  }

  return { tiers };
}

// Rates are published to two decimals: more is noise that makes every file differ between syncs.
function toSlimHeroRow(row: unknown): SlimHeroRow | undefined {
  if (!isRecord(row)) {
    return undefined;
  }

  const { heroId, winRate, pickRate, banRate, matches, wins, score } = row;

  if (
    !isInteger(heroId) ||
    !isFiniteNumber(winRate) ||
    !isFiniteNumber(pickRate) ||
    !isFiniteNumber(banRate) ||
    !isFiniteNumber(matches) ||
    !isFiniteNumber(wins) ||
    !isFiniteNumber(score)
  ) {
    return undefined;
  }

  return {
    heroId,
    winRate: roundToHundredths(winRate),
    pickRate: roundToHundredths(pickRate),
    banRate: roundToHundredths(banRate),
    matches,
    wins,
    score,
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
      { source: input.source, data: { ...season.details, ranks: season.ranks } },
      generatedAt,
      previous,
    ),
  }));

  const index = {
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
    warnings: describeUnknownHeroes(tierList.heroes, inputs.find((candidate) => candidate.dataset === 'heroes')?.data),
  };
}

// heroes.json has no game hero id, so a tier-list hero is matched to it by name
// or portrait file name. That is a best-effort check, and it is why this only warns.
function describeUnknownHeroes(listed: ReadonlyMap<number, HeroIdentity>, heroes: unknown): string[] {
  const known = new Set(
    (Array.isArray(heroes) ? heroes : []).flatMap((hero) =>
      isRecord(hero) ? [heroKey(hero['id']), heroKey(hero['name'])] : [],
    ),
  );
  const portraitKey = (imageUrl: unknown): string =>
    heroKey(typeof imageUrl === 'string' ? imageUrl.slice(imageUrl.lastIndexOf('/') + 1).replace(/\.[^.]*$/, '') : '');

  return [...listed]
    .filter(([, { name, imageUrl }]) => ![heroKey(name), portraitKey(imageUrl)].some((key) => key && known.has(key)))
    .map(
      ([heroId, { name }]) =>
        `heroId ${heroId} (${isNonEmptyString(name) ? name : 'unnamed'}) matches no hero in heroes.json by name or portrait, so it is published without one to join to`,
    );
}

// "Deadpool (Duelist)", "deadpool" and "DEADPOOL" are one hero.
function heroKey(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\(.*?\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') : '';
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
