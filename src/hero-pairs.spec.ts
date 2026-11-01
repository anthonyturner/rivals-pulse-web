import { HERO_PAIR_MIN_MATCHES, deriveHeroPairs, type HeroPairRow } from './hero-pairs';
import { WIN_RATE_PRIOR_MATCHES, type HeroAggregateRow, type HeroStatsSource } from './hero-stats';

const NOW = new Date('2026-10-30T12:00:00Z');
const HULK = 1011;
const THOR = 1022;
const STORM = 1033;
const DEADPOOL = 1057;
const LOKI = 1060;
const DEADPOOL_VANGUARD = 10571;
const DEADPOOL_DUELIST = 10572;
const BASE_IDS = new Map<number, number>([
  [HULK, HULK],
  [THOR, THOR],
  [STORM, STORM],
  [LOKI, LOKI],
  [DEADPOOL, DEADPOOL],
  [DEADPOOL_VANGUARD, DEADPOOL],
  [DEADPOOL_DUELIST, DEADPOOL],
]);
const SEASONS = [
  { halfSeason: 10, startsAt: '2026-07-10T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];

function row(
  kind: HeroPairRow['kind'],
  gameHeroId: number,
  otherGameHeroId: number,
  matches: number,
  wins: number,
  extra: Partial<HeroPairRow> = {},
): HeroPairRow {
  return {
    halfSeason: 10.5,
    rankBucket: -1,
    kind,
    gameHeroId,
    otherGameHeroId,
    decidedMatches: matches,
    decidedLines: matches,
    wins,
    ...extra,
  };
}

function heroRow(gameHeroId: number, lines: number, wins: number, extra: Partial<HeroAggregateRow> = {}): HeroAggregateRow {
  return {
    halfSeason: 10.5,
    playModeId: 1,
    gameHeroId,
    decidedLines: lines,
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

function sourceOf(heroes: HeroAggregateRow[] = [], totals: HeroStatsSource['totals'] = []): HeroStatsSource {
  return { halfSeasons: SEASONS, totals, heroes };
}

function derive(rows: HeroPairRow[], source: HeroStatsSource = sourceOf()) {
  return deriveHeroPairs(rows, source, { now: NOW, baseGameIdByGameId: BASE_IDS });
}

describe('deriveHeroPairs', () => {
  it('keeps the minimum at the 10 matches the database enforces and the prior at the tier rule\'s', () => {
    const { pairs } = derive([]);

    expect(HERO_PAIR_MIN_MATCHES).toBe(10);
    expect(pairs.minimumMatches).toBe(10);
    expect(pairs.priorMatches).toBe(WIN_RATE_PRIOR_MATCHES);
  });

  it('publishes counts only, one all-ranks band, and no rate', () => {
    const { pairs } = derive(
      [row('vs', HULK, THOR, 12, 9, { decidedLines: 14 }), row('with', HULK, STORM, 11, 6, { decidedLines: 13 })],
      sourceOf([heroRow(HULK, 40, 22)], [{ halfSeason: 10.5, playModeId: 1, decidedMatches: 30 }]),
    );

    expect(pairs.status).toBe('ready');
    expect(pairs.halfSeason?.id).toBe(10.5);
    expect(pairs.inPlaceOf).toBeNull();
    expect(pairs.bands).toEqual([
      {
        key: 'all',
        label: 'All Ranks',
        decidedMatches: 30,
        heroes: [{ heroId: HULK, appearances: 40, wins: 22 }],
        counters: [{ heroId: HULK, enemyHeroId: THOR, matches: 12, appearances: 14, wins: 9 }],
        synergies: [{ heroId: HULK, allyHeroId: STORM, matches: 11, appearances: 13, wins: 6 }],
      },
    ]);
    expect(JSON.stringify(pairs)).not.toMatch(/winRate|shrunk|edge/i);
  });

  it('blends Quick Match and Competitive and leaves other modes out of the heroes and the match total', () => {
    const { pairs } = derive(
      [row('vs', HULK, THOR, 10, 5)],
      sourceOf(
        [
          heroRow(HULK, 20, 11, { playModeId: 0 }),
          heroRow(HULK, 30, 14, { playModeId: 1 }),
          heroRow(HULK, 99, 99, { playModeId: 2 }),
          heroRow(HULK, 99, 99, { playModeId: -1 }),
        ],
        [
          { halfSeason: 10.5, playModeId: 0, decidedMatches: 25 },
          { halfSeason: 10.5, playModeId: 1, decidedMatches: 15 },
          { halfSeason: 10.5, playModeId: 3, decidedMatches: 400 },
        ],
      ),
    );

    expect(pairs.bands[0].decidedMatches).toBe(40);
    expect(pairs.bands[0].heroes).toEqual([{ heroId: HULK, appearances: 50, wins: 25 }]);
  });

  it('builds the all band from unknown-rank rows only, never from a rank bucket', () => {
    const { pairs } = derive([
      row('vs', HULK, THOR, 12, 9),
      row('vs', HULK, STORM, 40, 20, { rankBucket: 0 }),
      row('with', HULK, STORM, 40, 20, { rankBucket: 3 }),
    ]);

    expect(pairs.bands[0].counters.map((counter) => counter.enemyHeroId)).toEqual([THOR]);
    expect(pairs.bands[0].synergies).toEqual([]);
  });

  describe('Deadpool', () => {
    it('merges his role forms under the base id in counters, synergies and heroes', () => {
      const { pairs } = derive(
        [
          row('vs', DEADPOOL_VANGUARD, THOR, 6, 4),
          row('vs', DEADPOOL_DUELIST, THOR, 7, 3),
          row('vs', DEADPOOL, THOR, 5, 1),
          row('vs', HULK, DEADPOOL_DUELIST, 11, 5),
        ],
        sourceOf([heroRow(DEADPOOL_VANGUARD, 10, 6), heroRow(DEADPOOL_DUELIST, 8, 3), heroRow(DEADPOOL, 2, 1)]),
      );
      const [band] = pairs.bands;

      expect(band.counters).toEqual([
        { heroId: HULK, enemyHeroId: DEADPOOL, matches: 11, appearances: 11, wins: 5 },
        { heroId: DEADPOOL, enemyHeroId: THOR, matches: 18, appearances: 18, wins: 8 },
      ]);
      expect(band.heroes).toEqual([{ heroId: DEADPOOL, appearances: 20, wins: 10 }]);
    });

    // A guard, not today's data: the database drops every game-id pair below the minimum before this
    // code sees it, so thin rows like these do not arrive. It pins that the minimum is checked on the
    // merged count, so the answer stays right if that database function ever lets thinner rows through.
    it('guards the minimum on the merged count if thin rows ever reach the merge', () => {
      const thin = HERO_PAIR_MIN_MATCHES - 1;
      const { pairs } = derive([
        row('vs', DEADPOOL_VANGUARD, THOR, thin, 4),
        row('vs', DEADPOOL_DUELIST, THOR, 2, 1),
        row('vs', DEADPOOL_VANGUARD, STORM, thin, 4),
      ]);

      expect(pairs.bands[0].counters).toEqual([
        { heroId: DEADPOOL, enemyHeroId: THOR, matches: thin + 2, appearances: thin + 2, wins: 5 },
      ]);
    });

    it('drops Deadpool against, and with, another form of Deadpool', () => {
      const { pairs } = derive([
        row('vs', DEADPOOL_VANGUARD, DEADPOOL_DUELIST, 20, 10),
        row('with', DEADPOOL, DEADPOOL_VANGUARD, 20, 10),
        row('with', DEADPOOL_VANGUARD, DEADPOOL_DUELIST, 20, 10),
      ]);

      expect(pairs.status).toBe('not-enough-data');
      expect(pairs.bands[0].counters).toEqual([]);
      expect(pairs.bands[0].synergies).toEqual([]);
    });
  });

  describe('a hero against itself', () => {
    it('is dropped from the counters and the synergies', () => {
      const { pairs } = derive([row('vs', HULK, HULK, 30, 15), row('with', THOR, THOR, 30, 15)]);

      expect(pairs.bands[0].counters).toEqual([]);
      expect(pairs.bands[0].synergies).toEqual([]);
    });
  });

  describe('counters', () => {
    it('keep their direction and are sorted by hero id, not by strength', () => {
      const { pairs } = derive([row('vs', THOR, HULK, 10, 10), row('vs', HULK, THOR, 10, 0), row('vs', HULK, STORM, 10, 5)]);

      expect(pairs.bands[0].counters.map((counter) => `${counter.heroId}>${counter.enemyHeroId}`)).toEqual([
        '1011>1022',
        '1011>1033',
        '1022>1011',
      ]);
    });

    it('list a pair only once it has the minimum number of matches', () => {
      const { pairs } = derive([
        row('vs', HULK, THOR, HERO_PAIR_MIN_MATCHES - 1, 6),
        row('vs', HULK, STORM, HERO_PAIR_MIN_MATCHES, 4),
      ]);

      expect(pairs.bands[0].counters.map((counter) => counter.enemyHeroId)).toEqual([STORM]);
    });
  });

  describe('synergies', () => {
    it('are one pair in either order, listed with the lower hero id first', () => {
      const { pairs } = derive([row('with', STORM, HULK, 12, 7)]);

      expect(pairs.bands[0].synergies).toEqual([{ heroId: HULK, allyHeroId: STORM, matches: 12, appearances: 12, wins: 7 }]);
    });

    it('add the two orders a merge to the base id can produce', () => {
      // The database stores the lower game id first, so Deadpool's role form 10571 comes after 1060 while his base id 1057 comes before it.
      const { pairs } = derive([row('with', DEADPOOL, LOKI, 6, 3), row('with', LOKI, DEADPOOL_VANGUARD, 5, 2)]);

      expect(pairs.bands[0].synergies).toEqual([{ heroId: DEADPOOL, allyHeroId: LOKI, matches: 11, appearances: 11, wins: 5 }]);
    });

    it('count a match where both teams held the pair as two team occurrences and one match', () => {
      const { pairs } = derive([row('with', HULK, STORM, 10, 10, { decidedLines: 20 })]);

      expect(pairs.bands[0].synergies[0]).toEqual({ heroId: HULK, allyHeroId: STORM, matches: 10, appearances: 20, wins: 10 });
    });
  });

  describe('game hero ids with no hero', () => {
    it('are left out of every list and reported, hero id 0 included', () => {
      const { pairs, excludedGameIds } = derive(
        [row('vs', 0, HULK, 30, 15), row('with', HULK, 9999, 30, 15), row('vs', HULK, THOR, 10, 5)],
        sourceOf([heroRow(0, 50, 25), heroRow(HULK, 40, 20)]),
      );

      expect(pairs.bands[0].counters).toEqual([{ heroId: HULK, enemyHeroId: THOR, matches: 10, appearances: 10, wins: 5 }]);
      expect(pairs.bands[0].synergies).toEqual([]);
      expect(pairs.bands[0].heroes).toEqual([{ heroId: HULK, appearances: 40, wins: 20 }]);
      expect(excludedGameIds).toEqual([0, 9999]);
    });
  });

  describe('when the current half-season has no pair at the minimum', () => {
    const previous = (kind: HeroPairRow['kind'] = 'vs'): HeroPairRow => row(kind, HULK, THOR, 15, 8, { halfSeason: 10 });

    it('publishes the previous half-season\'s pairs and heroes, and names the current one it stands in for', () => {
      const { pairs } = derive(
        [previous(), row('vs', HULK, THOR, HERO_PAIR_MIN_MATCHES - 1, 5)],
        sourceOf(
          [heroRow(HULK, 50, 30, { halfSeason: 10 }), heroRow(HULK, 5, 4)],
          [
            { halfSeason: 10, playModeId: 1, decidedMatches: 70 },
            { halfSeason: 10.5, playModeId: 1, decidedMatches: 6 },
          ],
        ),
      );

      expect(pairs.status).toBe('ready');
      expect(pairs.halfSeason?.id).toBe(10);
      expect(pairs.inPlaceOf?.id).toBe(10.5);
      expect(pairs.bands[0]).toEqual(
        jasmine.objectContaining({
          decidedMatches: 70,
          heroes: [{ heroId: HULK, appearances: 50, wins: 30 }],
          counters: [{ heroId: HULK, enemyHeroId: THOR, matches: 15, appearances: 15, wins: 8 }],
        }),
      );
    });

    it('does the same when only a synergy reaches the minimum in the previous half-season', () => {
      const { pairs } = derive([previous('with')]);

      expect(pairs.inPlaceOf?.id).toBe(10.5);
      expect(pairs.bands[0].synergies.length).toBe(1);
    });

    it('stays on the current half-season, empty, when the previous one has no pair either', () => {
      const { pairs } = derive([], sourceOf([heroRow(HULK, 5, 4)], [{ halfSeason: 10.5, playModeId: 1, decidedMatches: 3 }]));

      expect(pairs.status).toBe('not-enough-data');
      expect(pairs.halfSeason?.id).toBe(10.5);
      expect(pairs.inPlaceOf).toBeNull();
      expect(pairs.bands[0].decidedMatches).toBe(3);
      expect(pairs.bands[0].counters).toEqual([]);
    });

    it('uses the current half-season whenever it has a pair, whatever the previous one holds', () => {
      const { pairs } = derive([previous(), row('with', HULK, THOR, 10, 5)]);

      expect(pairs.halfSeason?.id).toBe(10.5);
      expect(pairs.inPlaceOf).toBeNull();
      expect(pairs.bands[0].counters).toEqual([]);
    });
  });

  it('names no half-season and no band before any half-season exists', () => {
    const { pairs } = deriveHeroPairs([], { halfSeasons: [], totals: [], heroes: [] }, { now: NOW, baseGameIdByGameId: BASE_IDS });

    expect(pairs.status).toBe('not-enough-data');
    expect(pairs.halfSeason).toBeNull();
    expect(pairs.inPlaceOf).toBeNull();
    expect(pairs.bands).toEqual([]);
  });
});
