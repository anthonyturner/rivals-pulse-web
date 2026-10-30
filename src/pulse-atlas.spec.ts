import curatedHeroGameIds from '../data/pulse-atlas/hero-game-ids.json';
import curatedHeroStyles from '../data/pulse-atlas/hero-styles.json';
import {
  assembleCommunityHeroStats,
  buildPulseAtlas,
  findHeroGameIdProblems,
  findHeroStyleProblems,
  PULSE_ATLAS_DATASETS,
  PulseAtlasFile,
  PulseAtlasInput,
  assembleCommunityTierList,
  communityHalfSeasonRequests,
  verifyPulseAtlas,
} from './pulse-atlas';

const GENERATED_AT = '2026-10-26T12:00:00.000Z';
// Covers the whole text, so a one-character change anywhere changes the hash.
const fakeSha256 = (text: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return `sha:${text.length}:${hash.toString(16)}`;
};

const THOR_GAME_ID = 1039;
const thorEntry = { id: 'thor', gameId: THOR_GAME_ID };
// The game splits Deadpool into a base id and one id per role.
const DEADPOOL = {
  id: 'deadpool',
  gameId: 1057,
  gameIdVariants: [
    { gameId: 10571, role: 'Vanguard' },
    { gameId: 10572, role: 'Duelist' },
    { gameId: 10573, role: 'Strategist' },
  ],
};

function heroRow(heroId = THOR_GAME_ID, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    heroId,
    winRate: 55.12345678,
    pickRate: 7.777777,
    matches: 1000,
    wins: 551,
    ...extra,
  };
}

const PROVENANCE = 'rivals-pulse-community';
const ALL_RANKS = { value: '99', label: 'All Ranks' };

function tierList(heroesFor: (seasonId: number) => unknown[] = () => [heroRow()]): Record<string, unknown> {
  return {
    provenance: PROVENANCE,
    currentSeasonId: 2,
    rankFilters: [ALL_RANKS],
    seasons: [1, 2].map((id) => ({
      id,
      label: `Season ${id}`,
      startTime: `2026-0${id}-01T00:00:00+00:00`,
      ranks: {
        '99': { tiers: heroesFor(id).length === 0 ? [] : [{ name: 'S', heroes: heroesFor(id) }], matchesCounted: 1500 },
      },
    })),
  };
}

/** A hero below the minimum: only its appearances, and a game id that heroes.json does not know. */
const BELOW_MINIMUM_CELL = {
  heroId: 1016,
  appearances: 4,
  enoughData: false,
  winRate: null,
  pickRate: null,
  kda: null,
  finalHitsAverage: null,
};

/** The hero-stats dataset as `assembleCommunityHeroStats` returns it, trimmed to Thor. */
function heroStatsTable(seasonOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provenance: PROVENANCE,
    minimumMatches: 10,
    currentSeasonId: 2,
    seasons: [1, 2].map((id) => ({
      id,
      label: `Season ${id}`,
      startTime: `2026-0${id}-01T00:00:00+00:00`,
      decidedMatches: 40,
      heroes: [
        {
          heroId: THOR_GAME_ID,
          appearances: 30,
          enoughData: true,
          winRate: 66.666666,
          pickRate: 75,
          kda: 3.456789,
          finalHitsAverage: 4.5,
        },
      ],
      ...seasonOverrides,
    })),
  };
}

function validInputs(): PulseAtlasInput[] {
  return [
    { dataset: 'heroes', source: 'test', data: [{ id: 'thor', name: 'Thor' }] },
    {
      dataset: 'tier-list',
      source: 'test',
      data: tierList(),
    },
    { dataset: 'glossary', source: 'test', data: [{ id: 'dive', term: 'Dive' }] },
    { dataset: 'maps', source: 'test', data: [{ id: 1032, name: 'Yggdrasill Path' }] },
    { dataset: 'hero-styles', source: 'test', data: [{ heroId: 'thor', poke: 10, dive: 20, brawl: 70 }] },
    { dataset: 'hero-stats', source: 'test', data: heroStatsTable() },
    { dataset: 'hero-game-ids', source: 'test', data: [thorEntry] },
  ];
}

function withData(dataset: PulseAtlasInput['dataset'], data: unknown): PulseAtlasInput[] {
  return validInputs().map((input) => (input.dataset === dataset ? { ...input, data } : input));
}

describe('buildPulseAtlas', () => {
  it('wraps each dataset in the versioned envelope under pulse-atlas/v1', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const heroes = files.find((file) => file.path === 'pulse-atlas/v1/heroes.json');

    expect(JSON.parse(heroes?.content ?? 'null')).toEqual({
      schemaVersion: 1,
      generatedAt: GENERATED_AT,
      source: 'test',
      data: [{ id: 'thor', name: 'Thor', gameId: THOR_GAME_ID }],
    });
    expect(files.map((file) => file.path)).toEqual([
      'pulse-atlas/v1/heroes.json',
      'pulse-atlas/v1/tier-list.json',
      'pulse-atlas/v1/glossary.json',
      'pulse-atlas/v1/maps.json',
      'pulse-atlas/v1/hero-styles.json',
      'pulse-atlas/v1/hero-stats.json',
      'pulse-atlas/v1/tier-list/seasons/1.json',
      'pulse-atlas/v1/tier-list/seasons/2.json',
      'pulse-atlas/v1/manifest.json',
    ]);
  });

  it('lists every dataset file in the manifest with its hash and size', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const manifest = JSON.parse(files[files.length - 1].content);

    expect(manifest.generatedAt).toBe(GENERATED_AT);
    expect(manifest.files.map((entry: { dataset: string }) => entry.dataset)).toEqual([
      ...PULSE_ATLAS_DATASETS,
    ]);

    for (const entry of manifest.files) {
      const file = files.find((candidate) => candidate.path === entry.path);

      expect(entry.sha256).toBe(fakeSha256(file?.content ?? ''));
      expect(entry.bytes).toBe(new TextEncoder().encode(file?.content ?? '').length);
    }
  });

  it('keeps the file shape when only the source label changes', () => {
    const moved = validInputs().map((input) => ({ ...input, source: 'supabase' }));
    const shape = (inputs: PulseAtlasInput[]): string[] =>
      buildPulseAtlas(inputs, GENERATED_AT, fakeSha256).map((file) =>
        Object.keys(JSON.parse(file.content)).join(','),
      );

    expect(shape(moved)).toEqual(shape(validInputs()));
  });

  it('refuses an empty or missing dataset instead of publishing a broken file', () => {
    expect(() => buildPulseAtlas(withData('heroes', []), GENERATED_AT, fakeSha256)).toThrowError(
      /heroes: expected a non-empty list/,
    );
    expect(() => buildPulseAtlas(withData('glossary', null), GENERATED_AT, fakeSha256)).toThrowError(
      /glossary: expected a non-empty list/,
    );
    expect(() =>
      buildPulseAtlas(validInputs().slice(0, 3), GENERATED_AT, fakeSha256),
    ).toThrowError(/maps: expected exactly one input, got 0/);
  });

  it('strips counter picks from every hero before publishing', () => {
    const heroes = [
      { id: 'thor', name: 'Thor', counters: ['hulk'] },
      { id: 'loki', name: 'Loki', counters: [] },
    ];
    const styles = [
      { heroId: 'thor', poke: 10, dive: 20, brawl: 70 },
      { heroId: 'loki', poke: 40, dive: 10, brawl: 50 },
    ];
    const files = buildPulseAtlas(
      withData('heroes', heroes).map((input) => (input.dataset === 'hero-styles' ? { ...input, data: styles } : input)),
      GENERATED_AT,
      fakeSha256,
    );
    const published = JSON.parse(files[0].content).data;

    expect(published).toEqual([
      { id: 'thor', name: 'Thor', gameId: THOR_GAME_ID },
      { id: 'loki', name: 'Loki' },
    ]);
    expect(files[0].content).not.toContain('counters');
  });

  it('refuses a counters key anywhere else in the data', () => {
    const leaky = tierList(() => [heroRow(THOR_GAME_ID, { counters: ['hulk'] })]);

    expect(() =>
      buildPulseAtlas(withData('tier-list', leaky), GENERATED_AT, fakeSha256),
    ).toThrowError(/tier-list\.seasons\[0\]\.ranks\.99\.tiers\[0\]\.heroes\[0\]\.counters/);
  });

  it('refuses a dataset given twice and an empty source label', () => {
    expect(() =>
      buildPulseAtlas([...validInputs(), ...validInputs().slice(0, 1)], GENERATED_AT, fakeSha256),
    ).toThrowError(/heroes: expected exactly one input, got 2/);
    expect(() =>
      buildPulseAtlas(
        validInputs().map((input) => (input.dataset === 'maps' ? { ...input, source: '  ' } : input)),
        GENERATED_AT,
        fakeSha256,
      ),
    ).toThrowError(/maps: source label is empty/);
  });

  it('refuses malformed entries', () => {
    expect(() =>
      buildPulseAtlas(withData('maps', [{ id: 'x', name: 'Y' }]), GENERATED_AT, fakeSha256),
    ).toThrowError(/maps: item 0 needs an integer id/);
  });

  it('refuses data that looks like player data, a secret or counter-source data', () => {
    const leaks: [string, unknown][] = [
      ['key', [{ id: 'thor', name: 'Thor', playerId: '42' }]],
      ['key', [{ id: 'thor', name: 'Thor', apiToken: 'x' }]],
      ['value', [{ id: 'thor', name: 'Thor', note: 'sb_secret_abc123' }]],
      ['value', [{ id: 'thor', name: 'Thor', note: 'from Counter Watch' }]],
    ];

    for (const [kind, data] of leaks) {
      expect(() => buildPulseAtlas(withData('heroes', data), GENERATED_AT, fakeSha256))
        .withContext(`${kind} leak`)
        .toThrowError(/heroes\[0\]/);
    }
  });
});

describe('tier-list coverage', () => {
  it('accepts a season that lists no hero, and says so', () => {
    const warnings: string[] = [];
    const files = buildPulseAtlas(
      withData('tier-list', tierList((seasonId) => (seasonId === 2 ? [] : [heroRow()]))),
      GENERATED_AT,
      fakeSha256,
      [],
      (warning) => warnings.push(warning),
    );

    expect(warnings).toEqual(['tier-list: season 2 lists no hero yet, so it is published with empty tiers']);
    expect(() => verifyPulseAtlas(files, fakeSha256)).not.toThrow();
  });

  it('accepts a feed in which no season lists a hero yet', () => {
    expect(() => buildPulseAtlas(withData('tier-list', tierList(() => [])), GENERATED_AT, fakeSha256)).not.toThrow();
  });

  it('refuses a season that lacks one of the listed ranks', () => {
    const data = tierList() as { seasons: { ranks: Record<string, unknown> }[] };
    delete data.seasons[1].ranks['99'];

    expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
      /tier-list: season 2 has no tiers for rank 99/,
    );
  });
});

describe('the tier-list provenance', () => {
  it('is refused when the list does not carry the community provenance', () => {
    const { provenance: _provenance, ...bare } = tierList();
    const elsewhere = { ...bare, provenance: 'rivals-meta' };

    for (const data of [bare, elsewhere]) {
      expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
        /tier-list: provenance must be "rivals-pulse-community"/,
      );
    }
  });

  it('is refused for a list that still names Rivals Meta as its source', () => {
    const upstream = { ...tierList(), sourceName: 'Rivals Meta', sourceUrl: 'https://rivalsmeta.com/tier-list' };

    expect(() => buildPulseAtlas(withData('tier-list', upstream), GENERATED_AT, fakeSha256)).toThrowError(
      /tier-list\.sourceName/,
    );
  });
});

describe('the tier list split by season', () => {
  const SLIM_ROW = {
    heroId: THOR_GAME_ID,
    winRate: 55.12,
    pickRate: 7.78,
    matches: 1000,
    wins: 551,
  };
  const SNAPSHOT = { tiers: [{ name: 'S', heroes: [SLIM_ROW] }], matchesCounted: 1500 };

  interface Snapshot {
    tiers: { name: string; heroes: Record<string, unknown>[] }[];
    matchesCounted?: number;
    belowMinimum?: { heroId: number; matches: number }[];
    fallbackFromSeasonId?: number;
  }

  interface Season {
    provenance?: string;
    id: number;
    label?: string;
    startTime?: string;
    path?: string;
    sha256?: string;
    ranks?: Record<string, Snapshot>;
  }

  function fileAt(files: PulseAtlasFile[], path: string): PulseAtlasFile | undefined {
    return files.find((file) => file.path === path);
  }

  function envelopeOf<T>(files: PulseAtlasFile[], path: string): { schemaVersion: number; generatedAt: string; source: string; data: T } {
    return JSON.parse(fileAt(files, path)?.content ?? 'null');
  }

  function indexOf(files: PulseAtlasFile[]): { provenance?: string; currentSeasonId: number; seasons: Season[] } {
    return envelopeOf<{ provenance?: string; currentSeasonId: number; seasons: Season[] }>(
      files,
      'pulse-atlas/v1/tier-list.json',
    ).data;
  }

  const seasonPath = (id: number): string => `pulse-atlas/v1/tier-list/seasons/${id}.json`;

  it("keeps the current season's ranks on its own entry and gives every season a path and hash", () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const index = indexOf(files);

    expect(index.currentSeasonId).toBe(2);
    expect(index.seasons[0]).toEqual({
      id: 1,
      label: 'Season 1',
      startTime: '2026-01-01T00:00:00+00:00',
      path: seasonPath(1),
      sha256: fakeSha256(fileAt(files, seasonPath(1))?.content ?? ''),
    });
    expect(index.seasons[1].ranks).toEqual({ '99': SNAPSHOT });
    expect(index.seasons[1].path).toBe(seasonPath(2));
    expect(index.seasons[1].sha256).toBe(fakeSha256(fileAt(files, seasonPath(2))?.content ?? ''));
  });

  it('publishes each season in the standard envelope, with its ranks, at tier-list/seasons/<id>.json', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

    expect(envelopeOf(files, seasonPath(1))).toEqual({
      schemaVersion: 1,
      generatedAt: GENERATED_AT,
      source: 'test',
      data: {
        provenance: PROVENANCE,
        id: 1,
        label: 'Season 1',
        startTime: '2026-01-01T00:00:00+00:00',
        ranks: { '99': SNAPSHOT },
      },
    });
  });

  it('carries the community provenance at the top of the index and of every season file', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

    expect(indexOf(files).provenance).toBe(PROVENANCE);
    expect(envelopeOf<Season>(files, seasonPath(1)).data.provenance).toBe(PROVENANCE);
    expect(envelopeOf<Season>(files, seasonPath(2)).data.provenance).toBe(PROVENANCE);
  });

  describe('the tier-list source', () => {
    const TIER_LIST_PATHS = ['pulse-atlas/v1/tier-list.json', seasonPath(1), seasonPath(2)];

    it('is neither named nor linked in the index or any season file', () => {
      const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

      for (const path of TIER_LIST_PATHS) {
        const content = fileAt(files, path)?.content ?? '';

        expect(content).withContext(path).not.toMatch(/rivals\s*-?meta|rivalsmeta|sourceName|sourceUrl/i);
      }
    });

    it('publishes only the provenance, current season, rank filters and seasons in the index', () => {
      const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

      expect(Object.keys(indexOf(files))).toEqual(['provenance', 'currentSeasonId', 'rankFilters', 'seasons']);
    });

    it('is refused if a season detail ever names it', () => {
      const named = {
        ...(tierList() as { seasons: object[] }),
        seasons: (tierList() as { seasons: object[] }).seasons.map((season) => ({ ...season, name: 'Rivals Meta S1' })),
      };

      expect(() => buildPulseAtlas(withData('tier-list', named), GENERATED_AT, fakeSha256)).toThrowError(
        /tier-list\.seasons\[0\]\.name/,
      );
    });

    it('is not named by another dataset either', () => {
      const named = [{ id: 'thor', name: 'Thor', note: 'see https://rivalsmeta.com/characters' }];

      expect(() => buildPulseAtlas(withData('heroes', named), GENERATED_AT, fakeSha256)).toThrowError(/heroes\[0\]/);
    });

    it('is caught by its proper name in another dataset', () => {
      const named = [{ id: 'thor', name: 'Thor', note: 'ranked S by Rivals Meta' }];

      expect(() => buildPulseAtlas(withData('heroes', named), GENERATED_AT, fakeSha256)).toThrowError(/heroes\[0\]/);
    });

    it('lets the everyday phrase "Marvel Rivals meta" through', () => {
      const everyday = [{ id: 'thor', name: 'Thor', note: 'a staple of the current Marvel Rivals meta' }];

      expect(() => buildPulseAtlas(withData('heroes', everyday), GENERATED_AT, fakeSha256)).not.toThrow();
    });

    it('rewrites a published index that lacks the provenance and keeps the season files that are unchanged', () => {
      const before = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
      const { provenance: _provenance, ...oldIndex } = indexOf(before);
      const published = before.map((file) =>
        file.path === 'pulse-atlas/v1/tier-list.json'
          ? { ...file, content: `${JSON.stringify({ ...envelopeOf<object>(before, file.path), data: oldIndex })}\n` }
          : file,
      );
      const after = buildPulseAtlas(validInputs(), '2026-10-27T12:00:00.000Z', fakeSha256, published);

      expect(fileAt(after, seasonPath(1))).toEqual(fileAt(before, seasonPath(1)));
      expect(indexOf(after).provenance).toBe(PROVENANCE);
    });
  });

  it('does not list the season files in the manifest', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const manifest = JSON.parse(files[files.length - 1].content);

    expect(manifest.files.map((entry: { path: string }) => entry.path)).not.toContain(seasonPath(1));
    expect(manifest.files.length).toBe(PULSE_ATLAS_DATASETS.length);
  });

  it('publishes a hero row as the id and its four numbers, and keeps rates to two decimals', () => {
    const rows = tierList(() => [
      heroRow(THOR_GAME_ID, { winRate: 59.999, pickRate: 0.005, name: 'Thor', role: 'Vanguard', banRate: 3, score: 9 }),
    ]);
    const files = buildPulseAtlas(withData('tier-list', rows), GENERATED_AT, fakeSha256);

    for (const path of ['pulse-atlas/v1/tier-list.json', seasonPath(1), seasonPath(2)]) {
      expect(fileAt(files, path)?.content).withContext(path).not.toMatch(/"(?:role|imageUrl|banRate|score)":|Thor/);
    }
    expect(envelopeOf<Season>(files, seasonPath(1)).data.ranks?.['99'].tiers[0].heroes[0]).toEqual({
      ...SLIM_ROW,
      winRate: 60,
      pickRate: 0.01,
    });
  });

  it('keeps the matches counted, the heroes below the minimum and the season a snapshot stands in for', () => {
    const data = tierList() as { seasons: { ranks: Record<string, Snapshot> }[] };
    data.seasons[1].ranks['99'] = {
      tiers: [],
      matchesCounted: 12,
      belowMinimum: [{ heroId: THOR_GAME_ID, matches: 3 }],
      fallbackFromSeasonId: 1,
    };
    const files = buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256);

    expect(indexOf(files).seasons[1].ranks?.['99']).toEqual({
      tiers: [],
      matchesCounted: 12,
      belowMinimum: [{ heroId: THOR_GAME_ID, matches: 3 }],
      fallbackFromSeasonId: 1,
    });
  });

  it('refuses a snapshot whose extra fields are not numbers', () => {
    const bad: Record<string, unknown>[] = [
      { matchesCounted: -1 },
      { fallbackFromSeasonId: 1.5 },
      { belowMinimum: 'thor' },
      { belowMinimum: [{ heroId: 'thor', matches: 3 }] },
    ];

    for (const extra of bad) {
      const data = tierList() as { seasons: { ranks: Record<string, Snapshot> }[] };
      data.seasons[0].ranks['99'] = { tiers: [], ...extra };

      expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256))
        .withContext(JSON.stringify(extra))
        .toThrowError(/tier-list: season 1 rank 99 (needs|belowMinimum)/);
    }
  });

  describe('hero rows that heroes.json does not know', () => {
    const heroes = [
      { id: 'thor', name: 'Thor' },
      { id: 'deadpool', name: 'Deadpool' },
    ];

    function build(rows: unknown[], warn: (warning: string) => void = () => undefined): PulseAtlasFile[] {
      return buildPulseAtlas(
        withData('heroes', heroes).map((input) => {
          if (input.dataset === 'tier-list') {
            return { ...input, data: tierList(() => rows) };
          }

          return input.dataset === 'hero-game-ids' ? { ...input, data: [thorEntry, DEADPOOL] } : input;
        }),
        GENERATED_AT,
        fakeSha256,
        [],
        warn,
      );
    }

    function tierListWarnings(rows: unknown[]): string[] {
      const warnings: string[] = [];
      build(rows, (warning) => warnings.push(warning));

      return warnings.filter((warning) => warning.startsWith('tier-list:'));
    }

    it('warns once per hero, and still publishes the row', () => {
      const newcomer = heroRow(1099);
      const warnings = tierListWarnings([heroRow(), newcomer]);

      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('heroId 1099');
      expect(envelopeOf<Season>(build([newcomer]), seasonPath(1)).data.ranks?.['99'].tiers[0].heroes[0]['heroId']).toBe(
        1099,
      );
    });

    it('matches a row to Deadpool through his base id or any of his role ids', () => {
      expect(tierListWarnings([heroRow(1057), heroRow(10571), heroRow(10572), heroRow(10573)])).toEqual([]);
      expect(tierListWarnings([heroRow(10574)]).length).toBe(1);
    });
  });

  it('refuses a current season that the list does not contain', () => {
    const data = { ...tierList(), currentSeasonId: 9 };

    expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
      /tier-list: currentSeasonId 9 is not one of the listed seasons/,
    );
  });

  it('refuses a hero row without a heroId or with a rate that is not a number', () => {
    const noId = tierList(() => [heroRow(THOR_GAME_ID, { heroId: undefined })]);
    const noRate = tierList(() => [heroRow(THOR_GAME_ID, { winRate: '55%' })]);

    for (const data of [noId, noRate]) {
      expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
        /tier-list: season 1 rank 99 tier S hero 0 needs an integer heroId and numbers for winRate/,
      );
    }
  });

  it('still refuses player-level keys, even in a season with no hero', () => {
    const data = tierList(() => []) as { seasons: { ranks: Record<string, Record<string, unknown>> }[] };
    data.seasons[0].ranks['99']['playerCount'] = 7;

    expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
      /tier-list\.seasons\[0\]\.ranks\.99\.playerCount/,
    );
  });

  describe('against the published files', () => {
    const LATER_RUN = '2026-10-27T12:00:00.000Z';

    it('keeps every file, and so every hash, when nothing changed', () => {
      const before = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

      expect(buildPulseAtlas(validInputs(), LATER_RUN, fakeSha256, before)).toEqual(before);
    });

    it('rewrites only the season that changed, plus the index that holds its hash', () => {
      const before = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
      const changed = tierList((seasonId) => [heroRow(THOR_GAME_ID, seasonId === 1 ? { wins: 1 } : {})]);
      const after = buildPulseAtlas(withData('tier-list', changed), LATER_RUN, fakeSha256, before);

      expect(fileAt(after, seasonPath(2))).toEqual(fileAt(before, seasonPath(2)));
      expect(envelopeOf<Season>(after, seasonPath(1)).generatedAt).toBe(LATER_RUN);
      expect(indexOf(after).seasons[0].sha256).not.toBe(indexOf(before).seasons[0].sha256);
      expect(indexOf(after).seasons[1].sha256).toBe(indexOf(before).seasons[1].sha256);
      expect(envelopeOf<Season>(after, 'pulse-atlas/v1/tier-list.json').generatedAt).toBe(LATER_RUN);
    });
  });
});

describe('verifyPulseAtlas on the season files', () => {
  const seasonPath = (id: number): string => `pulse-atlas/v1/tier-list/seasons/${id}.json`;
  const TIER_LIST_PATH = 'pulse-atlas/v1/tier-list.json';
  const built = (): PulseAtlasFile[] => buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

  function contentOf(files: PulseAtlasFile[], path: string): string {
    return files.find((file) => file.path === path)?.content ?? '';
  }

  function replacing(files: PulseAtlasFile[], path: string, content: string): PulseAtlasFile[] {
    return files.map((file) => (file.path === path ? { ...file, content } : file));
  }

  it('accepts season files whose hashes match the index', () => {
    expect(() => verifyPulseAtlas(built(), fakeSha256)).not.toThrow();
  });

  it('rejects a season file changed after the index was built', () => {
    const files = built();

    expect(() =>
      verifyPulseAtlas(replacing(files, seasonPath(1), `${contentOf(files, seasonPath(1))} `), fakeSha256),
    ).toThrowError(/tier-list: season 1 file does not match its hash in tier-list\.json/);
  });

  it('rejects an index that points at a season file that was not written', () => {
    const files = built().filter((file) => file.path !== seasonPath(2));

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(
      /tier-list: season 2 has no file at pulse-atlas\/v1\/tier-list\/seasons\/2\.json/,
    );
  });

  it("rejects an index entry whose path is not the season's file", () => {
    const files = built();
    const moved = contentOf(files, TIER_LIST_PATH).replace(seasonPath(1), 'pulse-atlas/v1/tier-list/seasons/one.json');

    expect(() => verifyPulseAtlas(replacing(files, TIER_LIST_PATH, moved), fakeSha256)).toThrowError(
      /tier-list: season 1 path is not pulse-atlas\/v1\/tier-list\/seasons\/1\.json/,
    );
  });

  // Rewrites the tier-list index in place; the manifest is left alone, so its own hash check also fires.
  function withIndex(
    files: PulseAtlasFile[],
    change: (index: { seasons?: { ranks?: unknown; sha256?: string }[] }) => void,
  ): PulseAtlasFile[] {
    const envelope = JSON.parse(contentOf(files, TIER_LIST_PATH));
    change(envelope.data);

    return replacing(files, TIER_LIST_PATH, `${JSON.stringify(envelope)}\n`);
  }

  it('rejects ranks on a season that is not the current one', () => {
    const files = withIndex(built(), (index) => {
      index.seasons![0].ranks = {};
    });

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(
      /tier-list: season 1 must have ranks in the index if and only if it is the current season/,
    );
  });

  it('rejects a current season whose index entry has no ranks', () => {
    const files = withIndex(built(), (index) => {
      delete index.seasons![1].ranks;
    });

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(
      /tier-list: season 2 must have ranks in the index if and only if it is the current season/,
    );
  });

  it("rejects a season file that does not hold that season's ranks", () => {
    const files = built();
    const envelope = JSON.parse(contentOf(files, seasonPath(1)));
    delete envelope.data.ranks;
    const content = `${JSON.stringify(envelope)}\n`;
    const indexed = withIndex(replacing(files, seasonPath(1), content), (index) => {
      index.seasons![0].sha256 = fakeSha256(content);
    });

    expect(() => verifyPulseAtlas(indexed, fakeSha256)).toThrowError(
      /tier-list: season 1 file does not hold that season's ranks/,
    );
  });

  it('rejects an index without the community provenance', () => {
    const files = withIndex(built(), (index) => {
      delete (index as { provenance?: string }).provenance;
    });

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/tier-list: the index does not carry provenance/);
  });

  it('rejects a season file without the community provenance', () => {
    const files = built();
    const envelope = JSON.parse(contentOf(files, seasonPath(1)));
    delete envelope.data.provenance;
    const content = `${JSON.stringify(envelope)}
`;
    const indexed = withIndex(replacing(files, seasonPath(1), content), (index) => {
      index.seasons![0].sha256 = fakeSha256(content);
    });

    expect(() => verifyPulseAtlas(indexed, fakeSha256)).toThrowError(
      /tier-list: season 1 file does not carry provenance/,
    );
  });

  it('rejects an index that lists no seasons', () => {
    const files = withIndex(built(), (index) => {
      delete index.seasons;
    });

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/tier-list: has no seasons index/);
  });
});

describe('communityHalfSeasonRequests and assembleCommunityTierList', () => {
  interface StatsSeason {
    id: number;
    label: string;
    startsAt: string;
    endsAt: string | null;
  }

  const OLD: StatsSeason = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
  const NEW: StatsSeason = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
  const GAME_IDS = [thorEntry, DEADPOOL, { id: 'loki', gameId: 1016 }];

  const line = (hero: string, appearances: number, wins: number) => ({
    hero,
    tier: 'S',
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 50.5,
    shrunkWinRate: 60,
    kda: 3,
    finalHitsAverage: null,
  });

  /** A `/api/hero-stats` answer: `shown` is the half-season the numbers are from. */
  function answer(shown: StatsSeason | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      status: shown ? 'ready' : 'not-enough-data',
      minimumMatches: 10,
      halfSeasons: [OLD, NEW],
      halfSeason: shown,
      inPlaceOf: null,
      matchesCounted: 40,
      tiers: shown ? [{ name: 'S', heroes: [line('thor', 30, 20), line('deadpool', 12, 6)] }] : [],
      belowMinimum: [{ hero: 'loki', appearances: 4 }],
      ...extra,
    };
  }

  const others = [{ halfSeason: 10, response: answer(OLD) }];

  interface Assembled {
    provenance: string;
    currentSeasonId: number;
    rankFilters: unknown[];
    seasons: { id: number; label: string; startTime?: string; endTime?: string; ranks: Record<string, Record<string, unknown>> }[];
  }

  const assemble = (current = answer(NEW), rest = others, warn?: (warning: string) => void): Assembled =>
    assembleCommunityTierList(current, rest, GAME_IDS, warn) as Assembled;

  it('asks for every started half-season, the current one included', () => {
    expect(communityHalfSeasonRequests(answer(NEW))).toEqual([10, 10.5]);
  });

  it('counts the half-season the default answer stands in for as the current one', () => {
    const standingIn = answer(OLD, { inPlaceOf: NEW });

    expect(communityHalfSeasonRequests(standingIn)).toEqual([10, 10.5]);
    expect(assemble(standingIn).currentSeasonId).toBe(21);
  });

  it('makes a season of each half-season, with the id twice the half-season number', () => {
    const data = assemble();

    expect(data.seasons.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 20, label: 'Season 10' },
      { id: 21, label: 'Season 10.5' },
    ]);
    expect(data.currentSeasonId).toBe(21);
    expect(data.seasons[1].startTime).toBe('2026-10-09T09:00:00Z');
    expect(data.seasons[1].endTime).toBeUndefined();
    expect(data.seasons[0].endTime).toBe('2026-10-09T09:00:00Z');
  });

  it('carries the community provenance and offers only All Ranks', () => {
    const data = assemble();

    expect(data.provenance).toBe('rivals-pulse-community');
    expect(data.rankFilters).toEqual([{ value: '99', label: 'All Ranks' }]);
    expect(Object.keys(data.seasons[0].ranks)).toEqual(['99']);
  });

  it('turns each hero into the game id and the numbers, with appearances as matches', () => {
    const snapshot = assemble().seasons[1].ranks['99'];

    expect(snapshot['tiers']).toEqual([
      {
        name: 'S',
        heroes: [
          { heroId: THOR_GAME_ID, winRate: (20 / 30) * 100, pickRate: 50.5, matches: 30, wins: 20 },
          { heroId: 1057, winRate: 50, pickRate: 50.5, matches: 12, wins: 6 },
        ],
      },
    ]);
    expect(snapshot['matchesCounted']).toBe(40);
    expect(snapshot['belowMinimum']).toEqual([{ heroId: 1016, matches: 4 }]);
    expect(snapshot['fallbackFromSeasonId']).toBeUndefined();
  });

  it('publishes no ban rate, score or hero name', () => {
    expect(JSON.stringify(assemble())).not.toMatch(/banRate|score|"hero"|"tier"|kda/i);
  });

  it('names the season a snapshot stands in from when the current half-season has no placed hero', () => {
    const data = assemble(answer(OLD, { inPlaceOf: NEW }));

    expect(data.seasons[1].ranks['99']['fallbackFromSeasonId']).toBe(20);
    expect(data.seasons[0].ranks['99']['fallbackFromSeasonId']).toBeUndefined();
  });

  it('keeps a half-season with no hero as an empty season rather than leaving it out', () => {
    const empty = answer(NEW, { status: 'not-enough-data', tiers: [], matchesCounted: 3, belowMinimum: [] });
    const data = assemble(empty);

    expect(data.seasons[1].ranks['99']).toEqual({ tiers: [], matchesCounted: 3, belowMinimum: [] });
    expect(() =>
      buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256),
    ).not.toThrow();
  });

  it('leaves out a hero with no game id, and says which', () => {
    const warnings: string[] = [];
    const data = assembleCommunityTierList(
      answer(NEW, { tiers: [{ name: 'S', heroes: [line('thor', 30, 20), line('newcomer', 12, 6)] }] }),
      others,
      GAME_IDS,
      (warning) => warnings.push(warning),
    ) as Assembled;

    expect(JSON.stringify(data.seasons[1].ranks['99']['tiers'])).not.toContain('newcomer');
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('newcomer');
  });

  it('fails when the API answers with the old shape, as before the web app was deployed', () => {
    const old = { status: 'ready', minimumMatches: 10, halfSeason: NEW, tiers: [] };

    expect(() => communityHalfSeasonRequests(old)).toThrowError(/not the hero-stats shape.*deployed/);
    expect(() => assembleCommunityTierList(old, [], GAME_IDS)).toThrowError(/not the hero-stats shape/);
    expect(() => communityHalfSeasonRequests(null)).toThrowError(/not the hero-stats shape/);
  });

  it('fails when the API lists no half-season yet', () => {
    expect(() => communityHalfSeasonRequests(answer(null, { halfSeasons: [] }))).toThrowError(/no half-season yet/);
  });

  it('fails when the answer for another half-season is missing or is for a different one', () => {
    expect(() => assemble(answer(NEW), [])).toThrowError(/hero-stats\?halfSeason=10 is not the hero-stats shape/);
    expect(() => assemble(answer(NEW), [{ halfSeason: 10, response: answer(NEW) }])).toThrowError(
      /answered for half-season 10\.5, not 10/,
    );
    expect(() => assemble(answer(NEW), [{ halfSeason: 10, response: answer(OLD, { inPlaceOf: NEW }) }])).toThrowError(
      /answered for half-season 10 in place of 10\.5, not 10/,
    );
  });

  it('fails for a half-season that is not a whole or a half number', () => {
    const odd: StatsSeason = { id: 10.25, label: 'Season 10.25', startsAt: '2026-10-09T09:00:00Z', endsAt: null };

    expect(() => assembleCommunityTierList(answer(odd, { halfSeasons: [odd] }), [], GAME_IDS)).toThrowError(
      /no season id/,
    );
  });
});

describe('hero game ids', () => {
  const HERO_IDS = ['thor', 'deadpool'];
  const complete = (): object[] => [thorEntry, DEADPOOL];

  function build(map: unknown, warnings: string[] = []): PulseAtlasFile[] {
    return buildPulseAtlas(
      withData('heroes', [
        { id: 'thor', name: 'Thor' },
        { id: 'deadpool', name: 'Deadpool' },
      ]).map((input) => (input.dataset === 'hero-game-ids' ? { ...input, data: map } : input)),
      GENERATED_AT,
      fakeSha256,
      [],
      (warning) => warning.startsWith('hero-game-ids:') && warnings.push(warning),
    );
  }

  function publishedHeroes(files: PulseAtlasFile[]): unknown {
    return JSON.parse(files.find((file) => file.path.endsWith('/heroes.json'))?.content ?? 'null').data;
  }

  it('gives each hero its gameId, and Deadpool his role variants, in heroes.json', () => {
    const warnings: string[] = [];

    expect(publishedHeroes(build(complete(), warnings))).toEqual([
      { id: 'thor', name: 'Thor', gameId: THOR_GAME_ID },
      { ...DEADPOOL, name: 'Deadpool' },
    ]);
    expect(warnings).toEqual([]);
    expect(findHeroGameIdProblems(complete(), HERO_IDS)).toEqual({ errors: [], warnings: [] });
  });

  it('does not publish the map as a file of its own', () => {
    const files = build(complete());

    expect(files.some((file) => file.path.includes('hero-game-ids'))).toBeFalse();
    expect(files.filter((file) => !file.path.includes('/seasons/')).length).toBe(PULSE_ATLAS_DATASETS.length + 1);
  });

  it('publishes every dataset, with a warning, when a hero has no gameId', () => {
    const warnings: string[] = [];

    expect(publishedHeroes(build([thorEntry], warnings))).toEqual([
      { id: 'thor', name: 'Thor', gameId: THOR_GAME_ID },
      { id: 'deadpool', name: 'Deadpool' },
    ]);
    expect(warnings).toContain(
      'hero-game-ids: deadpool: no entry in hero-game-ids.json, so the hero is published without a gameId',
    );
  });

  it('leaves out, with a warning, an entry for a hero that is not in heroes.json', () => {
    const warnings: string[] = [];

    expect(publishedHeroes(build([...complete(), { id: 'hulk', gameId: 1011 }], warnings))).toEqual(
      publishedHeroes(build(complete())),
    );
    expect(warnings).toEqual(['hero-game-ids: hulk: not a hero in heroes.json, so its gameId is left out of the feed']);
  });

  it('still refuses when no entry names any hero, rather than stripping every id', () => {
    expect(() => build([{ id: 'hulk', gameId: 1011 }])).toThrowError(
      /hero-game-ids: no entry names a hero in heroes\.json/,
    );
  });

  it('refuses an input that is missing or empty', () => {
    expect(() => buildPulseAtlas(validInputs().slice(0, 5), GENERATED_AT, fakeSha256)).toThrowError(
      /hero-game-ids: expected exactly one input, got 0/,
    );
    expect(() => build([])).toThrowError(/hero-game-ids: expected a non-empty list/);
  });

  it('refuses a hero listed twice, or a gameId that is not a whole number above 0', () => {
    expect(findHeroGameIdProblems([...complete(), { id: 'thor', gameId: 1 }], HERO_IDS).errors).toEqual([
      'thor: listed more than once',
    ]);

    for (const gameId of [0, -1039, 1039.5, '1039', null, undefined]) {
      expect(findHeroGameIdProblems([{ id: 'thor', gameId }, DEADPOOL], HERO_IDS).errors)
        .withContext(String(gameId))
        .toEqual(['thor: gameId must be a whole number above 0']);
    }
    expect(() => build([{ id: 'thor', gameId: 0 }, DEADPOOL])).toThrowError(/hero-game-ids: thor: gameId must be/);
  });

  it('refuses one numeric id for two heroes, or for a hero and its own variant', () => {
    expect(findHeroGameIdProblems([thorEntry, { id: 'deadpool', gameId: THOR_GAME_ID }], HERO_IDS).errors).toEqual([
      "deadpool: gameId 1039 is already thor's",
    ]);
    expect(
      findHeroGameIdProblems(
        [thorEntry, { id: 'deadpool', gameId: 1057, gameIdVariants: [{ gameId: 1057, role: 'Duelist' }] }],
        HERO_IDS,
      ).errors,
    ).toEqual(['deadpool: gameId 1057 is already used twice by this hero']);
  });

  it('refuses a key the feed does not publish, instead of passing it onto the hero', () => {
    expect(findHeroGameIdProblems([{ ...thorEntry, name: 'Thor' }, DEADPOOL], HERO_IDS).errors).toEqual([
      'thor: unknown key name; an entry holds only id, gameId, gameIdVariants',
    ]);
    expect(() => build([{ ...thorEntry, counters: ['hulk'] }, DEADPOOL])).toThrowError(/hero-game-ids: thor: unknown key counters/);
  });

  it('refuses malformed variants', () => {
    const variants = (gameIdVariants: unknown): object[] => [
      thorEntry,
      { id: 'deadpool', gameId: 1057, gameIdVariants },
    ];

    expect(findHeroGameIdProblems(variants([]), HERO_IDS).errors).toEqual([
      'deadpool: gameIdVariants must be a non-empty list when present',
    ]);

    for (const bad of [{ gameId: 10571, role: 'Tank' }, { gameId: 10571 }, { gameId: 'x', role: 'Duelist' }, null]) {
      expect(findHeroGameIdProblems(variants([bad]), HERO_IDS).errors)
        .withContext(JSON.stringify(bad))
        .toEqual([
          'deadpool: every gameIdVariants entry needs a whole gameId above 0 and a role of Vanguard, Duelist, Strategist',
        ]);
    }
  });

  it('keeps the committed map sound: every hero once, each numeric id once, Deadpool covered', () => {
    const slugs = curatedHeroGameIds.map((entry) => entry.id);

    expect(findHeroGameIdProblems(curatedHeroGameIds, slugs)).toEqual({ errors: [], warnings: [] });
    expect(curatedHeroGameIds.find((entry) => entry.id === 'peni-parker')?.gameId).toBe(1042);
    expect(curatedHeroGameIds.find((entry) => entry.id === 'deadpool')).toEqual(DEADPOOL);
  });

  // The live hero list is only known at publish time (where a dangling slug warns), so this is the
  // build-time gate: both files are hand-maintained and list every hero the overlay knows.
  it('fails on a slug that is not in the committed playstyle mix, so a typo cannot ship', () => {
    const styled = curatedHeroStyles.map((style) => style.heroId);
    const dangling = curatedHeroGameIds.map((entry) => entry.id).filter((slug) => !styled.includes(slug));

    expect(dangling).toEqual([]);
  });
});

describe('hero-styles validation', () => {
  const HERO_IDS = ['thor', 'loki'];
  const entry = (heroId: string, poke: number, dive: number, brawl: number): object => ({
    heroId,
    poke,
    dive,
    brawl,
  });
  const complete = (): object[] => [entry('thor', 10, 20, 70), entry('loki', 40, 10, 50)];

  function build(data: unknown, warnings: string[] = []): PulseAtlasFile[] {
    return buildPulseAtlas(
      withData('heroes', [
        { id: 'thor', name: 'Thor' },
        { id: 'loki', name: 'Loki' },
      ]).map((input) => {
        if (input.dataset === 'hero-styles') {
          return { ...input, data };
        }

        return input.dataset === 'hero-game-ids'
          ? { ...input, data: [{ id: 'thor', gameId: THOR_GAME_ID }, { id: 'loki', gameId: 1016 }] }
          : input;
      }),
      GENERATED_AT,
      fakeSha256,
      [],
      (warning) => warnings.push(warning),
    );
  }

  function publishedStyles(files: PulseAtlasFile[]): unknown {
    return JSON.parse(files.find((file) => file.path.endsWith('/hero-styles.json'))?.content ?? 'null').data;
  }

  it('publishes a list that covers every hero exactly once, with no warning', () => {
    const warnings: string[] = [];

    expect(publishedStyles(build(complete(), warnings))).toEqual(complete());
    expect(warnings).toEqual([]);
    expect(findHeroStyleProblems(complete(), HERO_IDS)).toEqual({ errors: [], warnings: [] });
  });

  it('publishes every dataset, with a warning, when a hero in heroes.json has no entry', () => {
    const warnings: string[] = [];
    const files = build([entry('thor', 10, 20, 70)], warnings);

    expect(publishedStyles(files)).toEqual([entry('thor', 10, 20, 70)]);
    expect(files.filter((file) => !file.path.includes('/seasons/')).length).toBe(PULSE_ATLAS_DATASETS.length + 1);
    expect(warnings).toEqual([
      'hero-styles: loki: no entry in hero-styles.json, so the hero has no playstyle weights yet',
    ]);
  });

  it('leaves out, with a warning, an entry for a hero that is not in heroes.json', () => {
    const warnings: string[] = [];

    expect(publishedStyles(build([...complete(), entry('hulk', 5, 25, 70)], warnings))).toEqual(complete());
    expect(warnings).toEqual([
      'hero-styles: hulk: not a hero in heroes.json, so it is left out of hero-styles.json',
    ]);
  });

  it('warns about a missing hero and an unknown entry in the same run', () => {
    const warnings: string[] = [];

    expect(publishedStyles(build([entry('hulk', 5, 25, 70), entry('thor', 10, 20, 70)], warnings))).toEqual([
      entry('thor', 10, 20, 70),
    ]);
    expect(warnings.length).toBe(2);
  });

  it('still refuses when no entry names any hero, rather than publishing an empty file', () => {
    expect(() => build([entry('hulk', 5, 25, 70)])).toThrowError(
      /hero-styles: no entry names a hero in heroes\.json/,
    );
  });

  it('refuses a hero listed twice', () => {
    expect(findHeroStyleProblems([...complete(), entry('thor', 0, 0, 100)], HERO_IDS).errors).toEqual([
      'thor: listed more than once',
    ]);
    expect(() => build([...complete(), entry('thor', 0, 0, 100)])).toThrowError(
      /hero-styles: thor: listed more than once/,
    );
  });

  it('refuses negative, fractional or non-numeric weights', () => {
    for (const bad of [entry('thor', -10, 40, 70), entry('thor', 10.5, 19.5, 70), entry('thor', 10, 20, NaN)]) {
      expect(findHeroStyleProblems([bad, entry('loki', 40, 10, 50)], HERO_IDS).errors)
        .withContext(JSON.stringify(bad))
        .toEqual(['thor: poke, dive, brawl must each be a whole number of 0 or more']);
    }

    expect(
      findHeroStyleProblems([{ heroId: 'thor', poke: '10', dive: 20, brawl: 70 }, entry('loki', 40, 10, 50)], HERO_IDS).errors,
    ).toEqual(['thor: poke, dive, brawl must each be a whole number of 0 or more']);
    expect(() => build([entry('thor', -10, 40, 70), entry('loki', 40, 10, 50)])).toThrowError(
      /hero-styles: thor: poke, dive, brawl must each be a whole number/,
    );
  });

  it('refuses weights that do not add up to exactly 100', () => {
    for (const bad of [entry('thor', 10, 20, 69), entry('thor', 10, 20, 71), entry('thor', 0, 0, 0)]) {
      expect(findHeroStyleProblems([bad, entry('loki', 40, 10, 50)], HERO_IDS).errors)
        .withContext(JSON.stringify(bad))
        .toEqual(['thor: poke + dive + brawl must add up to exactly 100']);
    }
  });

  it('accepts a weight of zero', () => {
    expect(findHeroStyleProblems([entry('thor', 0, 80, 20), entry('loki', 40, 10, 50)], HERO_IDS)).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('refuses an empty list and an entry without a hero', () => {
    expect(findHeroStyleProblems([], HERO_IDS).errors).toEqual(['expected a non-empty list']);
    expect(findHeroStyleProblems([{ poke: 100, dive: 0, brawl: 0 }], HERO_IDS).errors).toContain(
      'entry 0 needs a non-empty string heroId',
    );
  });

  it('checks only the entries when the hero list itself is malformed', () => {
    expect(() =>
      buildPulseAtlas(
        withData('heroes', []).map((input) =>
          input.dataset === 'hero-styles' ? { ...input, data: [entry('thor', 1, 2, 3)] } : input,
        ),
        GENERATED_AT,
        fakeSha256,
      ),
    ).toThrowError(/heroes: expected a non-empty list[\s\S]*hero-styles: thor: poke \+ dive \+ brawl must add up/);
  });

  it('keeps the curated file sound: unique slugs and whole weights summing to 100', () => {
    const heroIds = curatedHeroStyles.map((style) => style.heroId);

    expect(curatedHeroStyles.length).toBe(54);
    expect(findHeroStyleProblems(curatedHeroStyles, heroIds)).toEqual({ errors: [], warnings: [] });
  });
});

describe('buildPulseAtlas against the published files', () => {
  const FIRST_RUN = '2026-10-26T12:00:00.000Z';
  const LATER_RUN = '2026-10-27T12:00:00.000Z';

  function published(): PulseAtlasFile[] {
    return buildPulseAtlas(validInputs(), FIRST_RUN, fakeSha256);
  }

  function fileAt(files: PulseAtlasFile[], name: string): PulseAtlasFile | undefined {
    return files.find((file) => file.path === `pulse-atlas/v1/${name}.json`);
  }

  it('reuses unchanged files byte for byte, so generatedAt and hashes stay the same', () => {
    const before = published();
    const after = buildPulseAtlas(validInputs(), LATER_RUN, fakeSha256, before);

    expect(after).toEqual(before);
  });

  it('treats the same data with reordered keys as unchanged', () => {
    const before = published();
    const reordered = withData('maps', [{ name: 'Yggdrasill Path', id: 1032 }]);
    const after = buildPulseAtlas(reordered, LATER_RUN, fakeSha256, before);

    expect(fileAt(after, 'maps')).toEqual(fileAt(before, 'maps'));
  });

  it('rebuilds only the dataset whose data changed', () => {
    const before = published();
    const changed = withData('maps', [{ id: 1032, name: 'Renamed' }]);
    const after = buildPulseAtlas(changed, LATER_RUN, fakeSha256, before);

    expect(fileAt(after, 'heroes')).toEqual(fileAt(before, 'heroes'));
    expect(JSON.parse(fileAt(after, 'maps')?.content ?? 'null').generatedAt).toBe(LATER_RUN);
  });

  it('dates the manifest by the latest dataset change', () => {
    const before = published();
    const unchanged = buildPulseAtlas(validInputs(), LATER_RUN, fakeSha256, before);
    const changed = buildPulseAtlas(
      withData('maps', [{ id: 1032, name: 'Renamed' }]),
      LATER_RUN,
      fakeSha256,
      before,
    );

    expect(JSON.parse(unchanged[unchanged.length - 1].content).generatedAt).toBe(FIRST_RUN);
    expect(JSON.parse(changed[changed.length - 1].content).generatedAt).toBe(LATER_RUN);
  });

  it('builds fresh when nothing usable is published', () => {
    const garbage: PulseAtlasFile[] = [
      { path: 'pulse-atlas/v1/heroes.json', content: 'not json' },
      { path: 'pulse-atlas/v1/maps.json', content: '{"data":[]}' },
    ];
    const after = buildPulseAtlas(validInputs(), LATER_RUN, fakeSha256, garbage);

    expect(JSON.parse(fileAt(after, 'heroes')?.content ?? 'null').generatedAt).toBe(LATER_RUN);
    expect(JSON.parse(fileAt(after, 'maps')?.content ?? 'null').generatedAt).toBe(LATER_RUN);
  });

  it('builds fresh when the source label changed, even if the data did not', () => {
    const before = published();
    const moved = validInputs().map((input) => ({ ...input, source: 'supabase' }));
    const after = buildPulseAtlas(moved, LATER_RUN, fakeSha256, before);

    expect(JSON.parse(fileAt(after, 'heroes')?.content ?? 'null').source).toBe('supabase');
  });
});

describe('verifyPulseAtlas', () => {
  it('accepts files whose hashes match the manifest', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

    expect(() => verifyPulseAtlas(files, fakeSha256)).not.toThrow();
  });

  it('rejects a file changed after the manifest was built', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256).map((file) =>
      file.path.endsWith('/maps.json') ? { ...file, content: `${file.content}\n ` } : file,
    );

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/maps: hash does not match/);
  });

  it('rejects a manifest whose byte count is wrong', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const manifestFile = files[files.length - 1];
    const manifest = JSON.parse(manifestFile.content);
    manifest.files[3].bytes += 1;
    const tampered = [...files.slice(0, -1), { ...manifestFile, content: JSON.stringify(manifest) }];

    expect(() => verifyPulseAtlas(tampered, fakeSha256)).toThrowError(/maps: bytes does not match/);
  });

  it('rejects a manifest that is not shaped as documented', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const withManifest = (content: string): PulseAtlasFile[] => [
      ...files.slice(0, -1),
      { path: 'pulse-atlas/v1/manifest.json', content },
    ];

    expect(() => verifyPulseAtlas(withManifest('nope'), fakeSha256)).toThrowError(/not shaped/);
    expect(() =>
      verifyPulseAtlas(
        withManifest(JSON.stringify({ schemaVersion: 1, generatedAt: 'x', files: [{ dataset: 'heroes' }] })),
        fakeSha256,
      ),
    ).toThrowError(/file entry without dataset, path, sha256 and bytes/);
  });

  it('rejects a missing manifest', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256).filter(
      (file) => !file.path.endsWith('/manifest.json'),
    );

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/no pulse-atlas\/v1\/manifest\.json/);
  });
});

describe('the hero-stats dataset', () => {
  const published = (inputs = validInputs()): PulseAtlasFile[] => buildPulseAtlas(inputs, GENERATED_AT, fakeSha256);
  const heroStatsOf = (files: PulseAtlasFile[]) =>
    JSON.parse(files.find((file) => file.path === 'pulse-atlas/v1/hero-stats.json')?.content ?? 'null');
  const withHeroStats = (data: unknown): PulseAtlasInput[] => withData('hero-stats', data);
  const withCell = (cell: Record<string, unknown>): Record<string, unknown> => {
    const table = heroStatsTable();
    const [season] = table['seasons'] as { heroes: Record<string, unknown>[] }[];
    season.heroes = [{ ...season.heroes[0], ...cell }];
    return table;
  };

  it('is one file in the manifest, in the standard envelope, with the provenance at the top of data', () => {
    const files = published();
    const manifest = JSON.parse(files[files.length - 1].content);
    const envelope = heroStatsOf(files);

    expect(manifest.files.map((entry: { dataset: string }) => entry.dataset)).toContain('hero-stats');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.source).toBe('test');
    expect(Object.keys(envelope.data)).toEqual(['provenance', 'minimumMatches', 'currentSeasonId', 'seasons']);
    expect(envelope.data.provenance).toBe(PROVENANCE);
  });

  it('keeps a cell to its seven allow-listed keys, rates to two decimals, cells in hero id order', () => {
    const table = heroStatsTable();
    const [season] = table['seasons'] as { heroes: unknown[] }[];
    season.heroes.push(BELOW_MINIMUM_CELL);
    season.heroes.reverse();

    const [first, second] = heroStatsOf(published(withHeroStats(table))).data.seasons[0].heroes;

    expect(second).toEqual({
      heroId: THOR_GAME_ID,
      appearances: 30,
      enoughData: true,
      winRate: 66.67,
      pickRate: 75,
      kda: 3.46,
      finalHitsAverage: 4.5,
    });
    expect(Object.keys(second)).toEqual(['heroId', 'appearances', 'enoughData', 'winRate', 'pickRate', 'kda', 'finalHitsAverage']);
    expect(first.heroId).toBe(1016);
  });

  it('flags a cell below the minimum and still carries its appearances', () => {
    const table = heroStatsTable();
    (table['seasons'] as { heroes: unknown[] }[])[0].heroes.push(BELOW_MINIMUM_CELL);

    const [below] = heroStatsOf(published(withHeroStats(table))).data.seasons[0].heroes;

    expect(below).toEqual(BELOW_MINIMUM_CELL);
  });

  it('is valid with no match at all: seasons with no hero and no decided match', () => {
    const empty = heroStatsTable({ decidedMatches: 0, heroes: [] });
    const files = published(withHeroStats(empty));

    expect(heroStatsOf(files).data.seasons.map((season: { heroes: unknown[] }) => season.heroes)).toEqual([[], []]);
    expect(() =>
      verifyPulseAtlas(
        files.map((file) => ({ path: file.path, content: file.content })),
        fakeSha256,
      ),
    ).not.toThrow();
  });

  it('refuses a table without the community provenance, or with another one', () => {
    const { provenance: _provenance, ...without } = heroStatsTable();

    expect(() => published(withHeroStats(without))).toThrowError(/hero-stats: provenance must be "rivals-pulse-community"/);
    expect(() => published(withHeroStats({ ...heroStatsTable(), provenance: 'rivalsmeta' }))).toThrowError(/provenance must be/);
  });

  describe('the allow-list and the privacy check', () => {
    it('refuses a key the file does not publish, at the top, on a season and on a cell', () => {
      const onSeason = heroStatsTable({ rank: 99 });
      const onCell = withCell({ tier: 'S' });

      expect(() => published(withHeroStats({ ...heroStatsTable(), source: 'x' }))).toThrowError(/the file has a key outside the allow-list: source/);
      expect(() => published(withHeroStats(onSeason))).toThrowError(/season 1 has a key outside the allow-list: rank/);
      expect(() => published(withHeroStats(onCell))).toThrowError(/season 1 hero 0 has a key outside the allow-list: tier/);
    });

    it('refuses player-level keys, however they are spelled', () => {
      for (const key of ['player', 'playerName', 'account_id', 'uid_token', 'email', 'sessionId']) {
        expect(() => published(withHeroStats(withCell({ [key]: 'x' })))).toThrowError(/hero-stats/);
      }
    });

    it('refuses a value that looks like a credential', () => {
      expect(() => published(withHeroStats(heroStatsTable({ label: 'sb_secret_abc' })))).toThrowError(/looks like a credential/);
    });

    it('publishes nothing but numbers, booleans and null in a cell, and only the season, count and time fields around them', () => {
      const data = heroStatsOf(published()).data;
      const keys = new Set<string>();
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else if (value !== null && typeof value === 'object') {
          Object.entries(value).forEach(([key, child]) => {
            keys.add(key);
            walk(child);
          });
        }
      };
      walk(data);

      expect([...keys].sort()).toEqual(
        [
          'appearances', 'currentSeasonId', 'decidedMatches', 'enoughData', 'finalHitsAverage', 'heroId', 'heroes', 'id',
          'kda', 'label', 'minimumMatches', 'pickRate', 'provenance', 'seasons', 'startTime', 'winRate',
        ].sort(),
      );
      expect(JSON.stringify(data)).not.toMatch(/player|account|session|steam|email|token|secret|uid|rivalsmeta/i);
    });
  });

  describe('a malformed table', () => {
    it('refuses an empty season list, an unlisted current season and a season listed twice', () => {
      expect(() => published(withHeroStats({ ...heroStatsTable(), seasons: [] }))).toThrowError(/non-empty seasons list/);
      expect(() => published(withHeroStats({ ...heroStatsTable(), currentSeasonId: 9 }))).toThrowError(/currentSeasonId 9 is not one of the listed seasons/);

      const twice = heroStatsTable();
      (twice['seasons'] as { id: number }[])[1].id = 1;
      expect(() => published(withHeroStats(twice))).toThrowError(/season 1 is listed more than once/);
    });

    it('refuses a minimum that is not a whole number above 0 and a decided-match count that is negative', () => {
      expect(() => published(withHeroStats({ ...heroStatsTable(), minimumMatches: 0 }))).toThrowError(/minimumMatches must be a whole number above 0/);
      expect(() => published(withHeroStats(heroStatsTable({ decidedMatches: -1 })))).toThrowError(/decidedMatches to be a non-negative whole number/);
    });

    it('refuses a cell whose enoughData disagrees with the minimum, in either direction', () => {
      expect(() => published(withHeroStats(withCell({ appearances: 9 })))).toThrowError(/says enoughData true with 9 appearances and a minimum of 10/);
      expect(() =>
        published(withHeroStats(withCell({ appearances: 10, enoughData: false }))),
      ).toThrowError(/says enoughData false with 10 appearances/);
    });

    it('refuses a cell with enough data but no win rate or pick rate', () => {
      expect(() => published(withHeroStats(withCell({ winRate: null })))).toThrowError(/has enough data but no winRate and pickRate/);
    });

    it('refuses a rate that is negative, not finite or not a number, and a cell without a hero id', () => {
      expect(() => published(withHeroStats(withCell({ kda: -1 })))).toThrowError(/kda to be a number of 0 or more, or null/);
      expect(() => published(withHeroStats(withCell({ pickRate: Number.NaN })))).toThrowError(/pickRate to be a number/);
      expect(() => published(withHeroStats(withCell({ winRate: '55' })))).toThrowError(/winRate to be a number/);
      expect(() => published(withHeroStats(withCell({ heroId: 'thor' })))).toThrowError(/needs an integer heroId/);
    });

    it('refuses a hero listed twice in a season', () => {
      const table = heroStatsTable();
      const [season] = table['seasons'] as { heroes: Record<string, unknown>[] }[];
      season.heroes.push({ ...season.heroes[0] });

      expect(() => published(withHeroStats(table))).toThrowError(/season 1 lists heroId 1039 more than once/);
    });
  });

  it('publishes a hero id that no hero in heroes.json has, with a warning', () => {
    const warnings: string[] = [];
    const table = heroStatsTable();
    (table['seasons'] as { heroes: unknown[] }[])[0].heroes.push(BELOW_MINIMUM_CELL);

    buildPulseAtlas(withHeroStats(table), GENERATED_AT, fakeSha256, [], (warning) => warnings.push(warning));

    expect(warnings).toEqual([
      'hero-stats: heroId 1016 is the gameId of no hero in heroes.json, so it is published without one to join to',
    ]);
  });

  it('keeps the published bytes, and so the hash, when the table has not changed', () => {
    const first = published();
    const again = buildPulseAtlas(validInputs(), '2026-10-27T00:00:00.000Z', fakeSha256, first);
    const path = 'pulse-atlas/v1/hero-stats.json';

    expect(again.find((file) => file.path === path)).toEqual(first.find((file) => file.path === path));
  });

  it('fails verification when the written file lost its provenance', () => {
    const files = published().map((file) =>
      file.path === 'pulse-atlas/v1/hero-stats.json'
        ? { ...file, content: file.content.replace('"provenance":"rivals-pulse-community",', '') }
        : file,
    );

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/hero-stats/);
  });
});

describe('assembleCommunityHeroStats', () => {
  interface StatsSeason {
    id: number;
    label: string;
    startsAt: string;
    endsAt: string | null;
  }

  const OLD: StatsSeason = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
  const NEW: StatsSeason = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
  const GAME_IDS = [thorEntry, DEADPOOL, { id: 'loki', gameId: 1016 }];

  const placed = (hero: string, appearances: number, wins: number) => ({
    hero,
    tier: 'S',
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: (appearances / 40) * 100,
    shrunkWinRate: 60,
    kda: 3.5,
    finalHitsAverage: null,
  });

  /** A `/api/hero-stats` answer: `shown` is the half-season the numbers are from. */
  function answer(shown: StatsSeason | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      status: shown ? 'ready' : 'not-enough-data',
      minimumMatches: 10,
      halfSeasons: [OLD, NEW],
      halfSeason: shown,
      inPlaceOf: null,
      matchesCounted: 40,
      tiers: shown ? [{ name: 'S', heroes: [placed('thor', 30, 20), placed('deadpool', 12, 6)] }] : [],
      belowMinimum: [{ hero: 'loki', appearances: 4 }],
      ...extra,
    };
  }

  const exact = [
    { halfSeason: 10, response: answer(OLD) },
    { halfSeason: 10.5, response: answer(NEW) },
  ];

  interface Assembled {
    provenance: string;
    minimumMatches: number;
    currentSeasonId: number;
    seasons: { id: number; label: string; decidedMatches: number; startTime?: string; endTime?: string; heroes: Record<string, unknown>[] }[];
  }

  const assemble = (current = answer(NEW), answers = exact, warn?: (warning: string) => void): Assembled =>
    assembleCommunityHeroStats(current, answers, GAME_IDS, warn) as Assembled;

  it('makes a season of each half-season, with the id twice the half-season number and the matches it counted', () => {
    const data = assemble();

    expect(data.provenance).toBe(PROVENANCE);
    expect(data.minimumMatches).toBe(10);
    expect(data.currentSeasonId).toBe(21);
    expect(data.seasons.map(({ id, label, decidedMatches }) => ({ id, label, decidedMatches }))).toEqual([
      { id: 20, label: 'Season 10', decidedMatches: 40 },
      { id: 21, label: 'Season 10.5', decidedMatches: 40 },
    ]);
    expect(data.seasons[0].endTime).toBe('2026-10-09T09:00:00Z');
    expect(data.seasons[1].endTime).toBeUndefined();
  });

  it('gives a hero with enough data its numbers, and one below the minimum only its appearances', () => {
    const [thor, deadpool, loki] = assemble().seasons[1].heroes;

    expect(thor).toEqual({
      heroId: THOR_GAME_ID,
      appearances: 30,
      enoughData: true,
      winRate: (20 / 30) * 100,
      pickRate: 75,
      kda: 3.5,
      finalHitsAverage: null,
    });
    expect(deadpool['heroId']).toBe(1057);
    expect(loki).toEqual({
      heroId: 1016,
      appearances: 4,
      enoughData: false,
      winRate: null,
      pickRate: null,
      kda: null,
      finalHitsAverage: null,
    });
  });

  it("uses the current half-season's own answer even when the default answer shows the previous one", () => {
    const standingIn = answer(OLD, { inPlaceOf: NEW });
    const emptyNew = answer(NEW, { tiers: [], belowMinimum: [], matchesCounted: 0 });
    const data = assemble(standingIn, [exact[0], { halfSeason: 10.5, response: emptyNew }]);

    expect(data.currentSeasonId).toBe(21);
    expect(data.seasons[1].heroes).toEqual([]);
    expect(data.seasons[1].decidedMatches).toBe(0);
  });

  it('is valid, and passes the gate, with zero matches in every half-season', () => {
    const none = (shown: StatsSeason) => answer(shown, { status: 'not-enough-data', tiers: [], belowMinimum: [], matchesCounted: 0 });
    const data = assemble(none(NEW), [
      { halfSeason: 10, response: none(OLD) },
      { halfSeason: 10.5, response: none(NEW) },
    ]);

    expect(data.seasons.map((season) => season.heroes)).toEqual([[], []]);
    expect(() => buildPulseAtlas(withData('hero-stats', data), GENERATED_AT, fakeSha256)).not.toThrow();
  });

  it('builds a table the gate accepts, on the real shape', () => {
    expect(() => buildPulseAtlas(withData('hero-stats', assemble()), GENERATED_AT, fakeSha256)).not.toThrow();
  });

  it('leaves out a hero with no game id, and says which', () => {
    const warnings: string[] = [];
    const data = assembleCommunityHeroStats(answer(NEW), exact, [thorEntry], (warning) => warnings.push(warning)) as Assembled;

    expect(data.seasons[1].heroes.map((hero) => hero['heroId'])).toEqual([THOR_GAME_ID]);
    expect(warnings.sort()).toEqual([
      'deadpool: no gameId in hero-game-ids.json, so the hero is left out of hero-stats',
      'loki: no gameId in hero-game-ids.json, so the hero is left out of hero-stats',
    ]);
  });

  it('fails when the answer for a half-season is missing, is for another one, or stands in for it', () => {
    expect(() => assemble(answer(NEW), [exact[0]])).toThrowError(/hero-stats\?halfSeason=10.5 is not the hero-stats shape/);
    expect(() => assemble(answer(NEW), [exact[0], { halfSeason: 10.5, response: answer(OLD) }])).toThrowError(
      /answered for half-season 10, not 10.5/,
    );
    expect(() => assemble(answer(NEW), [exact[0], { halfSeason: 10.5, response: answer(OLD, { inPlaceOf: NEW }) }])).toThrowError(
      /answered for half-season 10 in place of 10.5, not 10.5/,
    );
  });

  it('fails when the API answers with the shape from before a hero carried its KDA', () => {
    const { kda: _kda, ...noKda } = placed('thor', 30, 20);

    expect(() =>
      assemble(
        answer(NEW),
        [exact[0], { halfSeason: 10.5, response: answer(NEW, { tiers: [{ name: 'S', heroes: [noKda] }] }) }],
      ),
    ).toThrowError(/kda is not a number/);
  });

  it('fails when the API lists no half-season yet', () => {
    expect(() => assemble(answer(null, { halfSeasons: [] }), [])).toThrowError(/no half-season yet/);
  });
});
