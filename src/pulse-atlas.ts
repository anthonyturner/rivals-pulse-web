export const PULSE_ATLAS_SCHEMA_VERSION = 1;
export const PULSE_ATLAS_BASE_PATH = 'pulse-atlas/v1';
export const PULSE_ATLAS_DATASETS = ['heroes', 'tier-list', 'glossary', 'maps'] as const;

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

// Reference data never needs these words in a key, so a hit is treated as a
// leak of something private rather than as a false alarm. `counters` are
// matchup picks derived from a third-party site and are never published.
const UNSAFE_KEY =
  /secret|password|passwd|token|api[-_]?key|authorization|credential|email|puuid|player|steam|account|session|^counters?$/i;

// Credential shapes, plus the name of the scraped counter source the feed must
// never carry.
const UNSAFE_VALUE =
  /sb_secret_|libsql:\/\/|Bearer\s+\S|-----BEGIN|eyJ[\w-]{10,}\.[\w-]{10,}\.|counter\s*-?\s*watch/i;

interface BuiltDataset {
  dataset: PulseAtlasDataset;
  generatedAt: string;
  file: PulseAtlasFile;
}

/**
 * Builds every published file for one run: a wrapped file per dataset plus the
 * manifest. Throws, naming every problem found, if a dataset is missing, empty
 * or malformed, or if it carries anything that must not be public. Nothing is
 * returned in that case, so a bad run publishes nothing.
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
): PulseAtlasFile[] {
  const prepared = inputs.map(toPublicInput);
  const problems = findProblems(prepared);

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas refused to build:\n- ${problems.join('\n- ')}`);
  }

  const built = PULSE_ATLAS_DATASETS.flatMap((dataset): BuiltDataset[] => {
    const input = prepared.find((candidate) => candidate.dataset === dataset);

    return input ? [buildDataset(input, generatedAt, previous)] : [];
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
    { path: PULSE_ATLAS_MANIFEST_PATH, content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
}

/**
 * Checks files as they will be served (read back from disk) against their
 * manifest: every dataset is listed, and its path, hash and size all match.
 * Throws on any mismatch or on a manifest that is not shaped as documented.
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
  sourceName: unknown;
  sourceUrl: unknown;
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
 * missing). `fetchedAt` is dropped because it only records when the sync ran,
 * and would change the file without the data changing.
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

    const { fetchedAt: _fetchedAt, ...details } = season;

    return { ...details, ranks };
  });

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas could not assemble the tier list:\n- ${problems.join('\n- ')}`);
  }

  return {
    sourceName: parsed.sourceName,
    sourceUrl: parsed.sourceUrl,
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
    sourceName: index['sourceName'],
    sourceUrl: index['sourceUrl'],
    currentSeasonId: index['currentSeasonId'],
    rankFilters,
    seasons: seasons.filter(isRecord),
    seasonIds,
    ranks,
  };
}

function buildDataset(
  input: PulseAtlasInput,
  generatedAt: string,
  previous: readonly PulseAtlasFile[],
): BuiltDataset {
  const path = datasetPath(input.dataset);
  const unchanged = findUnchanged(input, previous.find((file) => file.path === path));

  if (unchanged) {
    return { dataset: input.dataset, generatedAt: unchanged.envelope.generatedAt, file: unchanged.file };
  }

  const envelope: PulseAtlasEnvelope = {
    schemaVersion: PULSE_ATLAS_SCHEMA_VERSION,
    generatedAt,
    source: input.source,
    data: input.data,
  };

  return {
    dataset: input.dataset,
    generatedAt,
    file: { path, content: `${JSON.stringify(envelope)}\n` },
  };
}

function findUnchanged(
  input: PulseAtlasInput,
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
    const shapeProblem = describeShapeProblem(dataset, input.data);

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

function describeShapeProblem(dataset: PulseAtlasDataset, data: unknown): string | undefined {
  switch (dataset) {
    case 'heroes':
      return describeListProblem(data, ['id', 'name']);
    case 'glossary':
      return describeListProblem(data, ['id', 'term']);
    case 'maps':
      return describeMapListProblem(data);
    case 'tier-list':
      return describeTierListProblem(data);
  }
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
  if (
    !isRecord(data) ||
    !Array.isArray(data['seasons']) ||
    data['seasons'].length === 0 ||
    !Array.isArray(data['rankFilters']) ||
    data['rankFilters'].length === 0
  ) {
    return 'expected an object with non-empty seasons and rankFilters lists';
  }

  const ranks = data['rankFilters'].map((filter) => (isRecord(filter) ? filter['value'] : undefined));

  if (!ranks.every(isNonEmptyString)) {
    return 'every rank filter needs a non-empty string value';
  }

  const problems: string[] = [];

  data['seasons'].forEach((season, index) => {
    if (!isRecord(season) || !Number.isInteger(season['id']) || !isRecord(season['ranks'])) {
      problems.push(`season ${index} needs an integer id and a ranks object`);
      return;
    }

    const snapshots = season['ranks'];
    const missing = ranks.filter((rank) => !hasTiers(snapshots[rank]));

    if (missing.length > 0) {
      problems.push(`season ${season['id']} has no tiers for rank ${missing.join(', ')}`);
    } else if (!ranks.some((rank) => listsAnyHero(snapshots[rank]))) {
      problems.push(`season ${season['id']} lists no hero at any rank`);
    }
  });

  return problems.length > 0 ? problems.join('; ') : undefined;
}

function hasTiers(snapshot: unknown): boolean {
  return isRecord(snapshot) && Array.isArray(snapshot['tiers']);
}

function listsAnyHero(snapshot: unknown): boolean {
  return (
    isRecord(snapshot) &&
    Array.isArray(snapshot['tiers']) &&
    snapshot['tiers'].some(
      (tier) => isRecord(tier) && Array.isArray(tier['heroes']) && tier['heroes'].length > 0,
    )
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
  } else if (typeof value === 'string' && UNSAFE_VALUE.test(value)) {
    found.push(`${path}: value looks like a credential or counter-source data`);
  }

  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
