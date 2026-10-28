import curatedHeroStyles from '../data/pulse-atlas/hero-styles.json';
import {
  buildPulseAtlas,
  findHeroStyleProblems,
  PULSE_ATLAS_DATASETS,
  PulseAtlasFile,
  PulseAtlasInput,
  TierListSnapshot,
  assembleTierList,
  tierListRequests,
  verifyPulseAtlas,
} from './pulse-atlas';

const GENERATED_AT = '2026-10-26T12:00:00.000Z';
const fakeSha256 = (text: string): string => `sha:${text.length}:${text.slice(-12)}`;

function tierList(
  heroesFor: (seasonId: number, rank: string) => unknown[] = () => [{ heroId: 1, name: 'Thor' }],
): unknown {
  return {
    sourceName: 'Test',
    sourceUrl: 'https://example.test',
    currentSeasonId: 2,
    rankFilters: [{ value: '99', label: 'All Ranks' }, { value: '5+', label: 'Diamond+' }],
    seasons: [1, 2].map((id) => ({
      id,
      label: `Season ${id}`,
      ranks: Object.fromEntries(
        ['99', '5+'].map((rank) => [rank, { tiers: [{ name: 'S', heroes: heroesFor(id, rank) }] }]),
      ),
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
      data: [{ id: 'thor', name: 'Thor' }],
    });
    expect(files.map((file) => file.path)).toEqual([
      'pulse-atlas/v1/heroes.json',
      'pulse-atlas/v1/tier-list.json',
      'pulse-atlas/v1/glossary.json',
      'pulse-atlas/v1/maps.json',
      'pulse-atlas/v1/hero-styles.json',
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
      { id: 'thor', name: 'Thor' },
      { id: 'loki', name: 'Loki' },
    ]);
    expect(files[0].content).not.toContain('counters');
  });

  it('refuses a counters key anywhere else in the data', () => {
    const leaky = tierList(() => [{ heroId: 1, name: 'Thor', counters: ['hulk'] }]);

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

  it('refuses malformed entries and tier lists with no heroes', () => {
    expect(() =>
      buildPulseAtlas(withData('maps', [{ id: 'x', name: 'Y' }]), GENERATED_AT, fakeSha256),
    ).toThrowError(/maps: item 0 needs an integer id/);
    expect(() =>
      buildPulseAtlas(withData('tier-list', tierList(() => [])), GENERATED_AT, fakeSha256),
    ).toThrowError(/tier-list: season 1 lists no hero at any rank; season 2 lists no hero at any rank/);
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
  it('accepts a rank with no heroes while the season has some elsewhere', () => {
    const sparse = tierList((_season, rank) => (rank === '99' ? [{ heroId: 1, name: 'Thor' }] : []));

    expect(() => buildPulseAtlas(withData('tier-list', sparse), GENERATED_AT, fakeSha256)).not.toThrow();
  });

  it('refuses a season that lacks one of the listed ranks', () => {
    const data = tierList() as { seasons: { ranks: Record<string, unknown> }[] };
    delete data.seasons[1].ranks['5+'];

    expect(() => buildPulseAtlas(withData('tier-list', data), GENERATED_AT, fakeSha256)).toThrowError(
      /tier-list: season 2 has no tiers for rank 5+/,
    );
  });
});

describe('tierListRequests and assembleTierList', () => {
  const index = {
    sourceName: 'Test',
    sourceUrl: 'https://example.test',
    currentSeasonId: 2,
    rankFilters: [{ value: '99', label: 'All Ranks' }, { value: '5+', label: 'Diamond+' }],
    seasons: [
      { id: 1, label: 'Season 1', fetchedAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, label: 'Season 2', fetchedAt: '2026-01-01T00:00:00.000Z' },
    ],
  };

  function snapshotsFor(
    pick: (seasonId: number, rank: string) => Record<string, unknown> = () => ({}),
  ): TierListSnapshot[] {
    return tierListRequests(index).map(({ seasonId, rank }) => ({
      seasonId,
      rank,
      response: {
        selectedSeasonId: seasonId,
        selectedRankFilter: rank,
        updatedAt: 'ignored',
        tiers: [{ name: 'S', heroes: [{ heroId: 1, name: 'Thor' }] }],
        ...pick(seasonId, rank),
      },
    }));
  }

  it('asks for every season and rank the API lists', () => {
    expect(tierListRequests(index)).toEqual([
      { seasonId: 1, rank: '99' },
      { seasonId: 1, rank: '5+' },
      { seasonId: 2, rank: '99' },
      { seasonId: 2, rank: '5+' },
    ]);
  });

  it('keys snapshots by season, then rank, and drops sync bookkeeping', () => {
    const data = assembleTierList(index, snapshotsFor()) as {
      seasons: { id: number; fetchedAt?: string; ranks: Record<string, unknown> }[];
      currentSeasonId: number;
    };

    expect(data.currentSeasonId).toBe(2);
    expect(data.seasons.map((season) => season.id)).toEqual([1, 2]);
    expect(Object.keys(data.seasons[0].ranks)).toEqual(['99', '5+']);
    expect(data.seasons[0].ranks['5+']).toEqual({
      tiers: [{ name: 'S', heroes: [{ heroId: 1, name: 'Thor' }] }],
    });
    expect(data.seasons[0].fetchedAt).toBeUndefined();
  });

  it('fails when a season and rank has no snapshot', () => {
    expect(() => assembleTierList(index, snapshotsFor().slice(1))).toThrowError(
      /season 1 rank 99: no snapshot returned/,
    );
  });

  it('fails when the API fell back to another rank', () => {
    const fellBack = snapshotsFor((seasonId, rank) =>
      seasonId === 2 && rank === '5+' ? { selectedRankFilter: '99' } : {},
    );

    expect(() => assembleTierList(index, fellBack)).toThrowError(
      /season 2 rank 5\+: the API answered with season 2 rank 99/,
    );
  });

  it('fails when the API does not list its seasons and ranks', () => {
    expect(() => tierListRequests({ seasons: [], rankFilters: [] })).toThrowError(/did not list/);
    expect(() => tierListRequests(null)).toThrowError(/did not list/);
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

  function build(data: unknown): PulseAtlasFile[] {
    return buildPulseAtlas(
      withData('heroes', [
        { id: 'thor', name: 'Thor' },
        { id: 'loki', name: 'Loki' },
      ]).map((input) => (input.dataset === 'hero-styles' ? { ...input, data } : input)),
      GENERATED_AT,
      fakeSha256,
    );
  }

  it('publishes a list that covers every hero exactly once', () => {
    const published = build(complete()).find((file) => file.path.endsWith('/hero-styles.json'));

    expect(JSON.parse(published?.content ?? 'null').data).toEqual(complete());
    expect(findHeroStyleProblems(complete(), HERO_IDS)).toEqual([]);
  });

  it('refuses a hero in heroes.json that has no entry', () => {
    expect(() => build([entry('thor', 10, 20, 70)])).toThrowError(
      /hero-styles: loki: no entry for this hero in heroes\.json/,
    );
  });

  it('refuses an entry for a hero that is not in heroes.json', () => {
    expect(() => build([...complete(), entry('hulk', 5, 25, 70)])).toThrowError(
      /hero-styles: hulk: not a hero in heroes\.json/,
    );
  });

  it('refuses a hero listed twice', () => {
    expect(findHeroStyleProblems([...complete(), entry('thor', 0, 0, 100)], HERO_IDS)).toEqual([
      'thor: listed more than once',
    ]);
  });

  it('refuses negative, fractional or non-numeric weights', () => {
    for (const bad of [entry('thor', -10, 40, 70), entry('thor', 10.5, 19.5, 70), entry('thor', 10, 20, NaN)]) {
      expect(findHeroStyleProblems([bad, entry('loki', 40, 10, 50)], HERO_IDS))
        .withContext(JSON.stringify(bad))
        .toEqual(['thor: poke, dive, brawl must each be a whole number of 0 or more']);
    }

    expect(
      findHeroStyleProblems([{ heroId: 'thor', poke: '10', dive: 20, brawl: 70 }, entry('loki', 40, 10, 50)], HERO_IDS),
    ).toEqual(['thor: poke, dive, brawl must each be a whole number of 0 or more']);
    expect(() => build([entry('thor', -10, 40, 70), entry('loki', 40, 10, 50)])).toThrowError(
      /hero-styles: thor: poke, dive, brawl must each be a whole number/,
    );
  });

  it('refuses weights that do not add up to exactly 100', () => {
    for (const bad of [entry('thor', 10, 20, 69), entry('thor', 10, 20, 71), entry('thor', 0, 0, 0)]) {
      expect(findHeroStyleProblems([bad, entry('loki', 40, 10, 50)], HERO_IDS))
        .withContext(JSON.stringify(bad))
        .toEqual(['thor: poke + dive + brawl must add up to exactly 100']);
    }
  });

  it('accepts a weight of zero', () => {
    expect(findHeroStyleProblems([entry('thor', 0, 80, 20), entry('loki', 40, 10, 50)], HERO_IDS)).toEqual([]);
  });

  it('refuses an empty list and an entry without a hero', () => {
    expect(findHeroStyleProblems([], HERO_IDS)).toEqual(['expected a non-empty list']);
    expect(findHeroStyleProblems([{ poke: 100, dive: 0, brawl: 0 }], HERO_IDS)).toContain(
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
    expect(findHeroStyleProblems(curatedHeroStyles, heroIds)).toEqual([]);
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
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256).slice(0, 4);

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/no pulse-atlas\/v1\/manifest\.json/);
  });
});
