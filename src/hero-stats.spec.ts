import type { TierName } from './contracts/tier-list.model.js';
import {
  BLENDED_PLAY_MODE_IDS,
  HERO_STATS_MIN_MATCHES,
  PLAY_MODE_IDS,
  deriveHeroStats,
  killDeathAssistRatio,
  shrunkWinRate,
  tierForShrunkWinRate,
  type HeroAggregateRow,
  type HeroStatsSource,
  type MatchTotalsRow,
} from './hero-stats';

// Fixtures ported from the overlay's personal tier list spec (rivals_pulse,
// src/app/services/personal-tier-list/personal-tier-list.spec.ts at commit
// 97ff7eeb885acd91531370c6f6f262e5c839eaca). The overlay builds saved matches; here the same
// scenarios are written as the counts `hero_aggregates` holds for them.
const MIN = HERO_STATS_MIN_MATCHES;
const NOW = new Date('2026-10-30T12:00:00Z');
const HERO_A = 1011;
const HERO_B = 1022;
const HERO_C = 1033;
const HERO_D = 1099;
const SLUGS = new Map<number, string>([
  [HERO_A, 'hulk'],
  [HERO_B, 'captain-america'],
  [HERO_C, 'black-widow'],
  [HERO_D, 'hero-d'],
  [1057, 'deadpool'],
  [10571, 'deadpool'],
  [10572, 'deadpool'],
]);

interface Played {
  heroes: HeroAggregateRow[];
  matches: number;
}

function heroRow(
  gameHeroId: number,
  decidedLines: number,
  wins: number,
  extra: Partial<HeroAggregateRow> = {},
): HeroAggregateRow {
  return {
    halfSeason: 10.5,
    playModeId: PLAY_MODE_IDS.competitive,
    gameHeroId,
    decidedLines,
    wins,
    killsSum: 0,
    killsN: 0,
    deathsSum: 0,
    deathsN: 0,
    assistsSum: 0,
    assistsN: 0,
    finalHitsSum: 0,
    finalHitsN: 0,
    ...extra,
  };
}

/** `count` matches of `mine` against `theirs`, the first `wins` of them won by `mine`'s side. */
function record(mine: number, theirs: number, count: number, wins: number): Played {
  return { heroes: [heroRow(mine, count, wins), heroRow(theirs, count, count - wins)], matches: count };
}

function sourceOf(records: Played[], extra: Partial<HeroStatsSource> = {}): HeroStatsSource {
  const totals: MatchTotalsRow[] = [
    {
      halfSeason: 10.5,
      playModeId: PLAY_MODE_IDS.competitive,
      decidedMatches: records.reduce((sum, item) => sum + item.matches, 0),
    },
  ];

  return {
    halfSeasons: [
      { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
      { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
    ],
    totals,
    heroes: records.flatMap((item) => item.heroes),
    ...extra,
  };
}

function derive(source: HeroStatsSource) {
  return deriveHeroStats(source, { now: NOW, heroSlugByGameId: SLUGS });
}

function heroOf(source: HeroStatsSource, slug: string) {
  return derive(source)
    .stats.tiers.flatMap((tier) => tier.heroes)
    .find((hero) => hero.hero === slug);
}

describe('hero stat tier rule (the overlay personal tier list)', () => {
  it('counts both teams, each line winning or losing with its own team', () => {
    const source = sourceOf([record(HERO_A, HERO_B, MIN, MIN)]);

    expect(heroOf(source, 'hulk')).toEqual(jasmine.objectContaining({ matches: MIN, wins: MIN, winRate: 100 }));
    expect(heroOf(source, 'captain-america')).toEqual(jasmine.objectContaining({ matches: MIN, wins: 0, winRate: 0 }));
  });

  it('credits a lost match to the other team', () => {
    const source = sourceOf([record(HERO_A, HERO_B, MIN, 0)]);

    expect(heroOf(source, 'hulk')?.wins).toBe(0);
    expect(heroOf(source, 'captain-america')?.wins).toBe(MIN);
  });

  it('lists a hero under the minimum sample as below the minimum and in no tier', () => {
    const { stats } = derive(sourceOf([record(HERO_A, HERO_B, MIN - 1, MIN - 1)]));

    expect(stats.tiers).toEqual([]);
    expect(stats.belowMinimum.map((hero) => hero.hero).sort()).toEqual(['captain-america', 'hulk']);
    expect(stats.belowMinimum[0].matches).toBe(MIN - 1);
    expect(stats.status).toBe('not-enough-data');
  });

  it('places a hero once it reaches the minimum sample', () => {
    const source = sourceOf([record(HERO_A, HERO_B, MIN, MIN)]);

    expect(heroOf(source, 'hulk')).toBeDefined();
    expect(derive(source).stats.belowMinimum).toEqual([]);
    expect(derive(source).stats.status).toBe('ready');
  });

  it('reports the pick rate as appearances over the matches counted', () => {
    const source = sourceOf([record(HERO_A, HERO_B, MIN, MIN), record(HERO_A, HERO_C, MIN, MIN)]);

    expect(heroOf(source, 'hulk')?.pickRate).toBe(100);
    expect(heroOf(source, 'captain-america')?.pickRate).toBe(50);
  });

  it('keeps a small-sample hero out of the top tier, which a big sample at the same win rate reaches', () => {
    const source = sourceOf([record(HERO_A, HERO_D, MIN, 7), record(HERO_B, HERO_D, 100, 70)]);

    expect(heroOf(source, 'hulk')).toEqual(jasmine.objectContaining({ winRate: 70 }));
    expect(heroOf(source, 'hulk')?.tier).not.toBe('S');
    expect(heroOf(source, 'captain-america')).toEqual(jasmine.objectContaining({ winRate: 70, tier: 'S' }));
  });

  it('does not let a perfect small sample outrank a proven hero inside a tier', () => {
    const source = sourceOf([record(HERO_A, HERO_D, MIN, MIN), record(HERO_B, HERO_D, 200, 180)]);

    const heroes = derive(source).stats.tiers.find((tier) => tier.name === 'S')?.heroes ?? [];

    expect(heroes.map((hero) => hero.hero)).toEqual(['captain-america', 'hulk']);
  });

  it('orders tiers best first and leaves out a tier no hero reached', () => {
    const { stats } = derive(sourceOf([record(HERO_A, HERO_B, MIN, MIN)]));

    expect(stats.tiers.map((tier) => tier.name)).toEqual(['S', 'F']);
    expect(stats.tiers[0].heroes[0].tier).toBe('S');
  });

  it('is empty for no matches', () => {
    const { stats } = derive(sourceOf([]));

    expect(stats.tiers).toEqual([]);
    expect(stats.belowMinimum).toEqual([]);
    expect(stats.matchesCounted).toBe(0);
  });

  it('shrinks a record toward 50% with ten pseudo-matches', () => {
    expect(shrunkWinRate(10, 10)).toBe(0.75);
    expect(shrunkWinRate(0, 10)).toBe(0.25);
    expect(shrunkWinRate(0, 0)).toBe(0.5);
  });

  it('places the exact cut-offs in the higher tier and the value just below in the lower', () => {
    const cases: [number, TierName][] = [
      [0.62, 'S'],
      [0.6199, 'A'],
      [0.56, 'A'],
      [0.5599, 'B'],
      [0.52, 'B'],
      [0.5199, 'C'],
      [0.48, 'C'],
      [0.4799, 'D'],
      [0.44, 'D'],
      [0.4399, 'F'],
      [0, 'F'],
      [1, 'S'],
    ];

    cases.forEach(([rate, tier]) => expect(tierForShrunkWinRate(rate)).withContext(String(rate)).toBe(tier));
  });
});

describe('deriveHeroStats modes and heroes', () => {
  it('blends Competitive and Quick Match and leaves out Arcade, Practice and unknown mode', () => {
    expect(BLENDED_PLAY_MODE_IDS).toEqual([PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive]);

    const heroes = [
      heroRow(HERO_A, 6, 6, { playModeId: PLAY_MODE_IDS.competitive }),
      heroRow(HERO_A, 4, 4, { playModeId: PLAY_MODE_IDS.quickMatch }),
      ...[PLAY_MODE_IDS.arcade, PLAY_MODE_IDS.practice, PLAY_MODE_IDS.unknown].map((playModeId) =>
        heroRow(HERO_A, 50, 0, { playModeId }),
      ),
    ];
    const totals = [
      { halfSeason: 10.5, playModeId: PLAY_MODE_IDS.unknown, decidedMatches: 50 },
      { halfSeason: 10.5, playModeId: PLAY_MODE_IDS.quickMatch, decidedMatches: 4 },
      { halfSeason: 10.5, playModeId: PLAY_MODE_IDS.competitive, decidedMatches: 6 },
      { halfSeason: 10.5, playModeId: PLAY_MODE_IDS.arcade, decidedMatches: 50 },
      { halfSeason: 10.5, playModeId: PLAY_MODE_IDS.practice, decidedMatches: 50 },
    ];

    const { stats } = derive({ halfSeasons: [], totals, heroes });

    expect(stats.matchesCounted).toBe(10);
    expect(stats.tiers[0].heroes[0]).toEqual(
      jasmine.objectContaining({ hero: 'hulk', matches: 10, wins: 10, pickRate: 100 }),
    );
  });

  it('leaves out a game hero id with no mapping, and reports it', () => {
    const source = sourceOf([record(HERO_A, 0, MIN, MIN)]);

    const { stats, excludedGameIds } = derive(source);

    expect(excludedGameIds).toEqual([0]);
    expect(stats.tiers.flatMap((tier) => tier.heroes).map((hero) => hero.hero)).toEqual(['hulk']);
    expect(stats.matchesCounted).toBe(MIN);
  });

  it('counts the base id and the role variants of a split hero as one hero', () => {
    const source = sourceOf([
      { heroes: [heroRow(10571, 4, 4), heroRow(10572, 4, 4), heroRow(1057, 2, 2)], matches: 10 },
    ]);

    expect(heroOf(source, 'deadpool')).toEqual(jasmine.objectContaining({ matches: 10, wins: 10 }));
    expect(derive(source).excludedGameIds).toEqual([]);
  });
});

describe('deriveHeroStats figures', () => {
  it('takes KDA as a ratio of totals, with no deaths treated as one', () => {
    expect(killDeathAssistRatio(30, 10, 10)).toBe(4);
    expect(killDeathAssistRatio(7, 0, 3)).toBe(10);

    const figures = { killsN: MIN, deathsN: MIN, assistsN: MIN };
    const withDeaths = sourceOf([
      { heroes: [heroRow(HERO_A, MIN, 5, { ...figures, killsSum: 60, deathsSum: 20, assistsSum: 20 })], matches: MIN },
    ]);
    const noDeaths = sourceOf([
      { heroes: [heroRow(HERO_A, MIN, 5, { ...figures, killsSum: 7, deathsSum: 0, assistsSum: 3 })], matches: MIN },
    ]);

    expect(heroOf(withDeaths, 'hulk')?.kda).toBe(4);
    expect(heroOf(noDeaths, 'hulk')?.kda).toBe(10);
  });

  it('gives no KDA or final-hits average when no line carried the figure, never NaN', () => {
    const hero = heroOf(sourceOf([record(HERO_A, HERO_B, MIN, 5)]), 'hulk');

    expect(hero?.kda).toBeNull();
    expect(hero?.finalHitsAverage).toBeNull();
  });

  it('averages final hits over the lines that had them', () => {
    const source = sourceOf([{ heroes: [heroRow(HERO_A, MIN, 5, { finalHitsSum: 30, finalHitsN: 6 })], matches: MIN }]);

    expect(heroOf(source, 'hulk')?.finalHitsAverage).toBe(5);
  });

  it('has a pick rate of 0, not NaN, when no matches were counted, and skips a hero with no decided lines', () => {
    const source: HeroStatsSource = {
      halfSeasons: [],
      totals: [],
      heroes: [heroRow(HERO_A, MIN, MIN), heroRow(HERO_B, 0, 0)],
    };

    const { stats } = derive(source);
    const hero = stats.tiers[0].heroes[0];

    expect(hero.pickRate).toBe(0);
    expect(Object.values(hero).every((value) => typeof value !== 'number' || Number.isFinite(value))).toBeTrue();
    expect(stats.belowMinimum).toEqual([]);
  });
});

describe('deriveHeroStats half-seasons', () => {
  const previous = (matches: number) => ({
    heroes: [heroRow(HERO_A, matches, matches, { halfSeason: 10 }), heroRow(HERO_B, matches, 0, { halfSeason: 10 })],
    total: { halfSeason: 10, playModeId: PLAY_MODE_IDS.competitive, decidedMatches: matches },
  });

  it('shows the current half-season, with its dates, once a hero reaches the minimum', () => {
    const { stats } = derive(sourceOf([record(HERO_A, HERO_B, MIN, MIN)]));

    expect(stats.halfSeason).toEqual({
      id: 10.5,
      label: 'Season 10.5',
      startsAt: '2026-10-09T09:00:00Z',
      endsAt: null,
    });
    expect(stats.inPlaceOf).toBeNull();
  });

  it('shows the previous half-season, labelled, while the current one is below the minimum', () => {
    const old = previous(MIN);
    const source = sourceOf([record(HERO_A, HERO_B, MIN - 1, MIN - 1)], {
      totals: [{ halfSeason: 10.5, playModeId: PLAY_MODE_IDS.competitive, decidedMatches: MIN - 1 }, old.total],
    });
    source.heroes = [...source.heroes, ...old.heroes];

    const { stats } = derive(source);

    expect(stats.status).toBe('ready');
    expect(stats.halfSeason).toEqual({
      id: 10,
      label: 'Season 10',
      startsAt: '2026-09-11T09:00:00Z',
      endsAt: '2026-10-09T09:00:00Z',
    });
    expect(stats.inPlaceOf?.id).toBe(10.5);
    expect(stats.matchesCounted).toBe(MIN);
  });

  it('falls back when the current half-season has no counts yet', () => {
    const old = previous(MIN);
    const source: HeroStatsSource = {
      halfSeasons: [
        { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
        { halfSeason: 11, startsAt: '2026-10-29T09:00:00Z' },
      ],
      totals: [old.total],
      heroes: old.heroes,
    };

    const { stats } = derive(source);

    expect(stats.halfSeason?.id).toBe(10);
    expect(stats.inPlaceOf?.id).toBe(11);
  });

  it('reports not enough data, for the current half-season, when neither half-season has a placed hero', () => {
    const old = previous(MIN - 1);
    const source = sourceOf([record(HERO_A, HERO_B, 3, 3)], {
      totals: [{ halfSeason: 10.5, playModeId: PLAY_MODE_IDS.competitive, decidedMatches: 3 }, old.total],
    });
    source.heroes = [...source.heroes, ...old.heroes];

    const { stats } = derive(source);

    expect(stats.status).toBe('not-enough-data');
    expect(stats.halfSeason?.id).toBe(10.5);
    expect(stats.inPlaceOf).toBeNull();
    expect(stats.matchesCounted).toBe(3);
  });

  it('does not use a half-season that has not started yet', () => {
    const source = sourceOf([record(HERO_A, HERO_B, MIN, MIN)], {
      halfSeasons: [
        { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
        { halfSeason: 11, startsAt: '2026-12-01T09:00:00Z' },
      ],
    });

    expect(derive(source).stats.halfSeason?.id).toBe(10.5);
  });

  it('uses the latest half-season with counts when no start dates exist', () => {
    const { stats } = derive(sourceOf([record(HERO_A, HERO_B, MIN, MIN)], { halfSeasons: [] }));

    expect(stats.halfSeason).toEqual({ id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null });
  });

  it('is a designed empty state with no half-season at all', () => {
    const { stats } = derive({ halfSeasons: [], totals: [], heroes: [] });

    expect(stats).toEqual({
      status: 'not-enough-data',
      minimumMatches: MIN,
      halfSeason: null,
      inPlaceOf: null,
      matchesCounted: 0,
      tiers: [],
      belowMinimum: [],
    });
  });
});
