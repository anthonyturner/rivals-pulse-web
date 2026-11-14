import type { HeroPairs, HeroPairsBand, HeroPairsCounter, HeroPairsHero } from '../../../contracts/hero-pairs.model';
import { counterEdges } from '../pairs/hero-pair-edges';
import {
  HERO_MATCHUP_MIN_MATCHES,
  deriveHeroMatchups,
  snapshotOf,
  type HeroMatchupFigures,
  type HeroMatchupRow,
} from './hero-matchups';
import { killDeathAssistRatio } from '../stats/hero-stats';

const HULK = 1011;
const THOR = 1022;
const STORM = 1033;
const DEADPOOL = 1057;
const SLUGS = new Map<number, string>([
  [HULK, 'hulk'],
  [THOR, 'thor'],
  [STORM, 'storm'],
  [DEADPOOL, 'deadpool'],
  [10571, 'deadpool'],
  [10572, 'deadpool'],
]);
const SEASON_10 = { id: 10, label: 'Season 10', startsAt: '2026-07-10T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const SEASON_10_5 = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };

function hero(heroId: number, appearances: number, wins: number): HeroPairsHero {
  return { heroId, appearances, wins };
}

function counter(heroId: number, enemyHeroId: number, matches: number, wins: number): HeroPairsCounter {
  return { heroId, enemyHeroId, matches, appearances: matches, wins };
}

/** Hulk, Thor and Storm each have 100 lines, Hulk winning 60: the usual records the pairs are judged against. */
const HEROES = [hero(HULK, 100, 60), hero(THOR, 100, 50), hero(STORM, 100, 50), hero(DEADPOOL, 100, 50)];

function pairsOf(counters: HeroPairsCounter[], extra: Partial<HeroPairs> = {}, heroes = HEROES): HeroPairs {
  const band: HeroPairsBand = { key: 'all', label: 'All Ranks', decidedMatches: 300, heroes, counters, synergies: [] };

  return {
    status: counters.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    priorMatches: 10,
    halfSeason: SEASON_10_5,
    inPlaceOf: null,
    bands: [band],
    ...extra,
  };
}

function row(
  gameHeroId: number,
  enemyGameHeroId: number,
  matches: number,
  wins: number,
  extra: Partial<HeroMatchupRow> = {},
): HeroMatchupRow {
  return {
    halfSeason: 10.5,
    gameHeroId,
    enemyGameHeroId,
    decidedMatches: matches,
    decidedLines: matches,
    wins,
    figures: null,
    ...extra,
  };
}

/** The figures of `lines` lines, each recording the same kills, deaths, assists and final hits. */
function figures(lines: number, kills: number, deaths: number, assists: number, finalHits: number): HeroMatchupFigures {
  return {
    killsSum: kills * lines,
    killsN: lines,
    deathsSum: deaths * lines,
    deathsN: lines,
    assistsSum: assists * lines,
    assistsN: lines,
    finalHitsSum: finalHits * lines,
    finalHitsN: lines,
  };
}

function derive(pairs: HeroPairs, figureRows: HeroMatchupRow[] = []) {
  return deriveHeroMatchups(pairs, figureRows, { heroSlugByGameId: SLUGS });
}

describe('deriveHeroMatchups', () => {
  it('keeps the minimum at the 10 matches the database enforces', () => {
    expect(HERO_MATCHUP_MIN_MATCHES).toBe(10);
  });

  it('lists each pair of the pair counts with the shrunk rate and edge the overlay computes from the same counts', () => {
    const pairs = pairsOf([counter(HULK, THOR, 20, 18), counter(THOR, HULK, 12, 3)]);
    const edges = counterEdges(pairs.bands[0], pairs.minimumMatches);
    const { matchups } = derive(pairs);

    expect(matchups.status).toBe('ready');
    expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.enemy, matchup.matches, matchup.wins])).toEqual([
      ['hulk', 'thor', 20, 18],
      ['thor', 'hulk', 12, 3],
    ]);
    expect(matchups.matchups[0].winRate).toBe(90);
    expect(matchups.matchups[0].shrunkWinRate).toBeCloseTo(edges[0].shrunkWinRate * 100, 9);
    expect(matchups.matchups[0].edge).toBeCloseTo(edges[0].edge * 100, 9);
    expect(matchups.matchups[1].edge).toBeCloseTo(edges[1].edge * 100, 9);
  });

  it('marks a pair a counter only when its edge over the hero\'s own record reaches 3 points', () => {
    // Hulk is usually (60 + 30) / 160 = 56.25%, so 18 of 20 (60%) clears it and 14 of 20 (55%) does not.
    const { matchups } = derive(pairsOf([counter(HULK, THOR, 20, 18), counter(HULK, STORM, 20, 14)]));

    expect(matchups.matchups.map((matchup) => [matchup.enemy, matchup.isCounter])).toEqual([
      ['storm', false],
      ['thor', true],
    ]);
  });

  it('judges a hero against its own record, not against 50%', () => {
    // 15 of 20 is 56.25% with the prior: a counter for a hero that usually wins 50%, not for one that wins 56.25%.
    const { matchups } = derive(pairsOf([counter(THOR, HULK, 20, 15), counter(HULK, THOR, 20, 15)]));

    expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.isCounter])).toEqual([
      ['hulk', false],
      ['thor', true],
    ]);
    expect(matchups.matchups.every((matchup) => matchup.shrunkWinRate > 50)).toBeTrue();
  });

  it('keeps a pair that is not a counter in the list, so a head-to-head can still show it', () => {
    const { matchups } = derive(pairsOf([counter(HULK, THOR, 12, 3)]));

    expect(matchups.status).toBe('ready');
    expect(matchups.matchups[0].isCounter).toBeFalse();
    expect(matchups.matchups[0].edge).toBeLessThan(0);
  });

  it('sorts by hero and then enemy, never by strength', () => {
    const { matchups } = derive(
      pairsOf([counter(THOR, HULK, 10, 10), counter(HULK, THOR, 10, 0), counter(HULK, STORM, 10, 5)]),
    );

    expect(matchups.matchups.map((matchup) => `${matchup.hero}>${matchup.enemy}`)).toEqual([
      'hulk>storm',
      'hulk>thor',
      'thor>hulk',
    ]);
  });

  it('names Deadpool by the base id the pair counts merge his forms under', () => {
    const { matchups } = derive(pairsOf([counter(DEADPOOL, THOR, 11, 6), counter(THOR, DEADPOOL, 11, 7)]));

    expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.enemy, matchup.matches, matchup.wins])).toEqual([
      ['deadpool', 'thor', 11, 6],
      ['thor', 'deadpool', 11, 7],
    ]);
  });

  it('leaves out a game hero id with no hero on either side, reports it, and keeps the rest', () => {
    const heroes = [...HEROES, hero(0, 100, 50)];
    const result = derive(pairsOf([counter(0, HULK, 20, 10), counter(HULK, 0, 20, 10), counter(HULK, THOR, 12, 6)], {}, heroes));

    expect(result.excludedGameIds).toEqual([0]);
    expect(result.matchups.matchups.map((matchup) => matchup.enemy)).toEqual(['thor']);
  });

  it('takes the minimum, the half-season and its fall-back from the pair counts', () => {
    const { matchups } = derive(pairsOf([counter(HULK, THOR, 12, 6)], { halfSeason: SEASON_10, inPlaceOf: SEASON_10_5 }));

    expect(matchups.minimumMatches).toBe(10);
    expect(matchups.halfSeason).toEqual(SEASON_10);
    expect(matchups.inPlaceOf).toEqual(SEASON_10_5);
  });

  it('answers with the designed empty state when the pair counts hold nothing', () => {
    const { matchups } = derive(pairsOf([]));

    expect(matchups).toEqual({
      status: 'not-enough-data',
      minimumMatches: 10,
      halfSeason: SEASON_10_5,
      inPlaceOf: null,
      matchups: [],
    });
  });

  it('answers with the empty state before any half-season exists, and with no band', () => {
    const none = pairsOf([], { halfSeason: null, bands: [] });

    expect(derive(none).matchups).toEqual({
      status: 'not-enough-data',
      minimumMatches: 10,
      halfSeason: null,
      inPlaceOf: null,
      matchups: [],
    });
  });

  it('never prints NaN, whatever the counts hold', () => {
    const { matchups } = derive(pairsOf([counter(HULK, THOR, 12, 6), counter(HULK, STORM, 20, 0)]));

    expect(JSON.stringify(matchups)).not.toMatch(/NaN|Infinity/);
  });

  describe('the figures while facing the enemy', () => {
    const pairs = pairsOf([counter(HULK, THOR, 12, 9)]);

    it('add each pair\'s KDA and final hits from hero_matchups for the half-season shown', () => {
      const [matchup] = derive(pairs, [row(HULK, THOR, 12, 9, { figures: figures(12, 6, 3, 9, 4) })]).matchups.matchups;

      expect(matchup.kda).toBe(5);
      expect(matchup.finalHitsAverage).toBe(4);
    });

    it('never change which pairs are listed or what their counts are', () => {
      const { matchups } = derive(pairs, [
        row(HULK, THOR, 40, 1, { figures: figures(40, 6, 3, 9, 4) }),
        row(HULK, STORM, 12, 9, { figures: figures(12, 6, 3, 9, 4) }),
      ]);

      expect(matchups.matchups.map((matchup) => [matchup.enemy, matchup.matches, matchup.wins])).toEqual([['thor', 12, 9]]);
    });

    it('are null, not zero, for a pair hero_matchups has no row for or no figures in', () => {
      expect(derive(pairs).matchups.matchups[0]).toEqual(jasmine.objectContaining({ kda: null, finalHitsAverage: null }));
      expect(derive(pairs, [row(HULK, THOR, 12, 9)]).matchups.matchups[0]).toEqual(
        jasmine.objectContaining({ kda: null, finalHitsAverage: null }),
      );
    });

    it('come only from the half-season the pair counts show', () => {
      const shown = pairsOf([counter(HULK, THOR, 12, 9)], { halfSeason: SEASON_10, inPlaceOf: SEASON_10_5 });
      const [matchup] = derive(shown, [
        row(HULK, THOR, 12, 9, { halfSeason: 10, figures: figures(12, 2, 1, 4, 3) }),
        row(HULK, THOR, 12, 9, { figures: figures(12, 9, 9, 9, 9) }),
      ]).matchups.matchups;

      expect(matchup.kda).toBe(6);
      expect(matchup.finalHitsAverage).toBe(3);
    });

    it('keep the two directions of a pair apart', () => {
      const both = pairsOf([counter(HULK, THOR, 12, 9), counter(THOR, HULK, 12, 3)]);
      const { matchups } = derive(both, [
        row(HULK, THOR, 12, 9, { figures: figures(12, 6, 3, 9, 4) }),
        row(THOR, HULK, 12, 3, { figures: figures(12, 1, 6, 0, 2) }),
      ]);

      expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.kda])).toEqual([
        ['hulk', 5],
        ['thor', 1 / 6],
      ]);
    });
  });
});

describe('snapshotOf, the figures of hero_matchups', () => {
  function snapshot(rows: HeroMatchupRow[]) {
    return snapshotOf(rows, 10.5, SLUGS);
  }

  it('works out KDA with the shared formula and final hits per line from sums and counts', () => {
    const [matchup] = snapshot([row(HULK, THOR, 12, 9, { figures: figures(12, 6, 3, 9, 4) })]).matchups;

    expect(matchup.kda).toBe(killDeathAssistRatio(72, 36, 108));
    expect(matchup.kda).toBe(5);
    expect(matchup.finalHitsAverage).toBe(4);
  });

  it('sums the sums and the counts across modes before dividing, never averaging the rows', () => {
    const quick = row(HULK, THOR, 6, 3, { figures: figures(6, 10, 2, 0, 12) });
    const competitive = row(HULK, THOR, 4, 1, { figures: figures(4, 0, 6, 0, 0) });
    const [matchup] = snapshot([quick, competitive]).matchups;

    expect(matchup.kda).toBe(killDeathAssistRatio(60, 36, 0));
    expect(matchup.kda).not.toBe((10 / 2 + 0 / 6) / 2);
    expect(matchup.finalHitsAverage).toBe(72 / 10);
  });

  it('sums the rows of every game id a hero merges, such as the Deadpool forms', () => {
    const { matchups } = snapshot([
      row(10571, THOR, 6, 4, { figures: figures(6, 4, 2, 2, 5) }),
      row(10572, THOR, 5, 2, { figures: figures(5, 1, 4, 0, 1) }),
    ]);

    expect(matchups[0].kda).toBe(killDeathAssistRatio(29, 32, 12));
    expect(matchups[0].finalHitsAverage).toBe(35 / 11);
  });

  it('divides by the lines that recorded a figure, so a line without one is not a zero', () => {
    const partial: HeroMatchupFigures = { ...figures(12, 6, 3, 9, 0), finalHitsSum: 20, finalHitsN: 5 };
    const [matchup] = snapshot([row(HULK, THOR, 12, 9, { figures: partial })]).matchups;

    expect(matchup.finalHitsAverage).toBe(4);
  });

  it('is null, not zero or NaN, when no line recorded the figure', () => {
    const none: HeroMatchupFigures = { ...figures(12, 6, 3, 9, 4), killsN: 0, killsSum: 0, finalHitsN: 0, finalHitsSum: 0 };
    const [matchup] = snapshot([row(HULK, THOR, 12, 9, { figures: none })]).matchups;

    expect(matchup.kda).toBeNull();
    expect(matchup.finalHitsAverage).toBeNull();
    expect(JSON.stringify(matchup)).not.toContain('NaN');
  });

  it('is null for rows from before the figures existed, in the old row shape', () => {
    const [matchup] = snapshot([row(HULK, THOR, 12, 9), row(HULK, THOR, 4, 1)]).matchups;

    expect(matchup.matches).toBe(16);
    expect(matchup.kda).toBeNull();
    expect(matchup.finalHitsAverage).toBeNull();
  });

  it('uses the rows that have figures when a frozen half-season row has none', () => {
    const [matchup] = snapshot([row(HULK, THOR, 6, 3), row(HULK, THOR, 6, 3, { figures: figures(6, 2, 1, 4, 3) })]).matchups;

    expect(matchup.kda).toBe(6);
    expect(matchup.finalHitsAverage).toBe(3);
  });

  it('counts the win rate over scoreboard lines when they outnumber matches', () => {
    const [matchup] = snapshot([row(HULK, THOR, 10, 6, { decidedLines: 12 })]).matchups;

    expect(matchup.matches).toBe(10);
    expect(matchup.winRate).toBe(50);
  });

  it('lists a pair only once it has the minimum number of matches', () => {
    const { matchups } = snapshot([row(HULK, THOR, HERO_MATCHUP_MIN_MATCHES - 1, 6), row(HULK, STORM, HERO_MATCHUP_MIN_MATCHES, 4)]);

    expect(matchups.map((matchup) => matchup.enemy)).toEqual(['storm']);
  });

  it('drops a hero facing itself, including one Deadpool form against another', () => {
    expect(snapshot([row(HULK, HULK, 12, 6), row(10571, 10572, 12, 6)]).matchups).toEqual([]);
  });

  it('leaves out an unmapped hero id on either side, and reports it', () => {
    const result = snapshot([row(0, HULK, 20, 10), row(HULK, 0, 20, 10), row(HULK, THOR, 12, 6)]);

    expect([...result.excludedGameIds]).toEqual([0]);
    expect(result.matchups.map((matchup) => matchup.enemy)).toEqual(['thor']);
  });

  it('reads only the half-season asked for', () => {
    expect(snapshotOf([row(HULK, THOR, 12, 6, { halfSeason: 10 })], 10.5, SLUGS).matchups).toEqual([]);
  });
});
