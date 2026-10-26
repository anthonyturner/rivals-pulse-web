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
  generatedAt: string;
  files: PulseAtlasManifestEntry[];
}

export interface PulseAtlasFile {
  /** Path relative to the Pages site root, e.g. `pulse-atlas/v1/heroes.json`. */
  path: string;
  content: string;
}

const MANIFEST_PATH = `${PULSE_ATLAS_BASE_PATH}/manifest.json`;

// Reference data never needs these words in a key, so a hit is treated as a
// leak of something private rather than as a false alarm.
const UNSAFE_KEY =
  /secret|password|passwd|token|api[-_]?key|authorization|credential|email|puuid|player|steam|account|session/i;

// Credential shapes, plus the name of the scraped counter source the feed must
// never carry.
const UNSAFE_VALUE =
  /sb_secret_|libsql:\/\/|Bearer\s+\S|-----BEGIN|eyJ[\w-]{10,}\.[\w-]{10,}\.|counter\s*-?\s*watch/i;

/**
 * Builds every published file for one run: a wrapped file per dataset plus the
 * manifest. Throws, naming every problem found, if a dataset is missing, empty
 * or malformed, or if it carries anything that must not be public. Nothing is
 * returned in that case, so a bad run publishes nothing.
 */
export function buildPulseAtlas(
  inputs: readonly PulseAtlasInput[],
  generatedAt: string,
  sha256: Sha256Hex,
): PulseAtlasFile[] {
  const problems = findProblems(inputs);

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas refused to build:\n- ${problems.join('\n- ')}`);
  }

  const files = PULSE_ATLAS_DATASETS.flatMap((dataset) => {
    const input = inputs.find((candidate) => candidate.dataset === dataset);

    if (!input) {
      return [];
    }

    const envelope: PulseAtlasEnvelope = {
      schemaVersion: PULSE_ATLAS_SCHEMA_VERSION,
      generatedAt,
      source: input.source,
      data: input.data,
    };
    const content = `${JSON.stringify(envelope)}\n`;

    return [{ dataset, file: { path: datasetPath(dataset), content } }];
  });

  const manifest: PulseAtlasManifest = {
    schemaVersion: PULSE_ATLAS_SCHEMA_VERSION,
    generatedAt,
    files: files.map(({ dataset, file }) => ({
      dataset,
      path: file.path,
      sha256: sha256(file.content),
      bytes: new TextEncoder().encode(file.content).length,
    })),
  };

  return [
    ...files.map(({ file }) => file),
    { path: MANIFEST_PATH, content: `${JSON.stringify(manifest, null, 2)}\n` },
  ];
}

/**
 * Checks files as they will be served (read back from disk) against their
 * manifest. Throws on a missing file or a hash that does not match.
 */
export function verifyPulseAtlas(files: readonly PulseAtlasFile[], sha256: Sha256Hex): void {
  const manifestFile = files.find((file) => file.path === MANIFEST_PATH);

  if (!manifestFile) {
    throw new Error(`Pulse Atlas has no ${MANIFEST_PATH}.`);
  }

  const manifest = JSON.parse(manifestFile.content) as PulseAtlasManifest;
  const problems: string[] = [];

  for (const dataset of PULSE_ATLAS_DATASETS) {
    const entry = manifest.files.find((candidate) => candidate.dataset === dataset);
    const file = files.find((candidate) => candidate.path === datasetPath(dataset));

    if (!entry || !file) {
      problems.push(`${dataset}: missing from the manifest or the published files`);
    } else if (entry.path !== file.path || entry.sha256 !== sha256(file.content)) {
      problems.push(`${dataset}: hash does not match the manifest`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Pulse Atlas failed verification:\n- ${problems.join('\n- ')}`);
  }
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
  if (!isRecord(data) || !Array.isArray(data['tiers']) || data['tiers'].length === 0) {
    return 'expected an object with a non-empty tiers list';
  }

  const hasHeroes = data['tiers'].some(
    (tier) => isRecord(tier) && Array.isArray(tier['heroes']) && tier['heroes'].length > 0,
  );

  return hasHeroes ? undefined : 'no tier lists any hero';
}

function findUnsafeContent(value: unknown, path: string): string[] {
  const found: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findUnsafeContent(item, `${path}[${index}]`)));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_KEY.test(key)) {
        found.push(`${path}.${key}: key looks private`);
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
