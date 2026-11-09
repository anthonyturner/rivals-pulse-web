import {
  HERO_MATCHUP_MIN_MATCHES,
  deriveHeroMatchups,
  type HeroMatchupFigures,
  type HeroMatchupRow,
} from './hero-matchups';
import { killDeathAssistRatio, shrunkWinRate } from '../stats/hero-stats';

const NOW = new Date('2026-10-30T12:00:00Z');
const HULK = 1011;
const THOR = 1022;
const STORM = 1033;
const SLUGS = new Map<number, string>([
  [HULK, 'hulk'],
  [THOR, 'thor'],
  [STORM, 'storm'],
  [1057, 'deadpool'],
  [10571, 'deadpool'],
  [10572, 'deadpool'],
]);
const SEASONS = [
  { halfSeason: 10, startsAt: '2026-07-10T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];

function row(gameHeroId: number, enemyGameHeroId: number, matches: number, wins: number, extra: Partial<HeroMatchupRow> = {}): HeroMatchupRow {
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

function derive(rows: HeroMatchupRow[], seasons = SEASONS) {
  return deriveHeroMatchups(rows, seasons, { now: NOW, heroSlugByGameId: SLUGS });
}

describe('deriveHeroMatchups', () => {
  it('keeps the minimum at the 10 matches the database enforces', () => {
    expect(HERO_MATCHUP_MIN_MATCHES).toBe(10);
  });

  it('gives each matchup the same shrunk win rate the tier rule uses', () => {
    const { matchups } = derive([row(HULK, THOR, 12, 9)]);

    expect(matchups.status).toBe('ready');
    expect(matchups.matchups).toEqual([
      {
        hero: 'hulk',
        enemy: 'thor',
        matches: 12,
        appearances: 12,
        wins: 9,
        winRate: 75,
        shrunkWinRate: shrunkWinRate(9, 12) * 100,
        kda: null,
        finalHitsAverage: null,
      },
    ]);
  });

  describe('the figures while facing the enemy', () => {
    it('works out KDA with the shared formula and final hits per line from sums and counts', () => {
      const [matchup] = derive([row(HULK, THOR, 12, 9, { figures: figures(12, 6, 3, 9, 4) })]).matchups.matchups;

      expect(matchup.kda).toBe(killDeathAssistRatio(72, 36, 108));
      expect(matchup.kda).toBe(5);
      expect(matchup.finalHitsAverage).toBe(4);
    });

    it('sums the sums and the counts across modes before dividing, never averaging the rows', () => {
      const quick = row(HULK, THOR, 6, 3, { figures: figures(6, 10, 2, 0, 12) });
      const competitive = row(HULK, THOR, 4, 1, { figures: figures(4, 0, 6, 0, 0) });
      const [matchup] = derive([quick, competitive]).matchups.matchups;

      expect(matchup.kda).toBe(killDeathAssistRatio(60, 36, 0));
      expect(matchup.kda).not.toBe((10 / 2 + 0 / 6) / 2);
      expect(matchup.finalHitsAverage).toBe(72 / 10);
    });

    it('sums the rows of every game id a hero merges, such as the Deadpool forms', () => {
      const { matchups } = derive([
        row(10571, THOR, 6, 4, { figures: figures(6, 4, 2, 2, 5) }),
        row(10572, THOR, 5, 2, { figures: figures(5, 1, 4, 0, 1) }),
      ]);

      expect(matchups.matchups[0].kda).toBe(killDeathAssistRatio(29, 32, 12));
      expect(matchups.matchups[0].finalHitsAverage).toBe(35 / 11);
    });

    it('divides by the lines that recorded a figure, so a line without one is not a zero', () => {
      const partial: HeroMatchupFigures = { ...figures(12, 6, 3, 9, 0), finalHitsSum: 20, finalHitsN: 5 };
      const [matchup] = derive([row(HULK, THOR, 12, 9, { figures: partial })]).matchups.matchups;

      expect(matchup.finalHitsAverage).toBe(4);
    });

    it('is null, not zero or NaN, when no line recorded the figure', () => {
      const none: HeroMatchupFigures = { ...figures(12, 6, 3, 9, 4), killsN: 0, killsSum: 0, finalHitsN: 0, finalHitsSum: 0 };
      const [matchup] = derive([row(HULK, THOR, 12, 9, { figures: none })]).matchups.matchups;

      expect(matchup.kda).toBeNull();
      expect(matchup.finalHitsAverage).toBeNull();
      expect(JSON.stringify(matchup)).not.toContain('NaN');
    });

    it('is null for rows from before the figures existed, in the old row shape', () => {
      const [matchup] = derive([row(HULK, THOR, 12, 9), row(HULK, THOR, 4, 1)]).matchups.matchups;

      expect(matchup.matches).toBe(16);
      expect(matchup.kda).toBeNull();
      expect(matchup.finalHitsAverage).toBeNull();
    });

    it('uses the rows that have figures when a frozen half-season row has none', () => {
      const [matchup] = derive([row(HULK, THOR, 6, 3), row(HULK, THOR, 6, 3, { figures: figures(6, 2, 1, 4, 3) })]).matchups
        .matchups;

      expect(matchup.kda).toBe(6);
      expect(matchup.finalHitsAverage).toBe(3);
    });

    it('keeps the two directions of a pair apart', () => {
      const { matchups } = derive([
        row(HULK, THOR, 12, 9, { figures: figures(12, 6, 3, 9, 4) }),
        row(THOR, HULK, 12, 3, { figures: figures(12, 1, 6, 0, 2) }),
      ]);

      expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.kda])).toEqual([
        ['hulk', 5],
        ['thor', 1 / 6],
      ]);
    });
  });

  it('counts the win rate over scoreboard lines when they outnumber matches', () => {
    const [matchup] = derive([row(HULK, THOR, 10, 6, { decidedLines: 12 })]).matchups.matchups;

    expect(matchup.matches).toBe(10);
    expect(matchup.winRate).toBe(50);
  });

  it('lists a pair only once it has the minimum number of matches', () => {
    const { matchups } = derive([row(HULK, THOR, HERO_MATCHUP_MIN_MATCHES - 1, 6), row(HULK, STORM, HERO_MATCHUP_MIN_MATCHES, 4)]);

    expect(matchups.matchups.map((matchup) => matchup.enemy)).toEqual(['storm']);
  });

  it('sorts by hero and then enemy, never by strength', () => {
    const { matchups } = derive([row(THOR, HULK, 10, 10), row(HULK, THOR, 10, 0), row(HULK, STORM, 10, 5)]);

    expect(matchups.matchups.map((matchup) => `${matchup.hero}>${matchup.enemy}`)).toEqual([
      'hulk>storm',
      'hulk>thor',
      'thor>hulk',
    ]);
  });

  it('counts every Deadpool id as the one hero and sums their matchups', () => {
    const { matchups } = derive([
      row(10571, THOR, 6, 4),
      row(10572, THOR, 5, 2),
      row(THOR, 1057, 11, 7),
    ]);

    expect(matchups.matchups.map((matchup) => [matchup.hero, matchup.enemy, matchup.matches, matchup.wins])).toEqual([
      ['deadpool', 'thor', 11, 6],
      ['thor', 'deadpool', 11, 7],
    ]);
  });

  it('drops a hero facing itself, including one Deadpool form against another', () => {
    const { matchups } = derive([row(HULK, HULK, 12, 6), row(10571, 10572, 12, 6)]);

    expect(matchups.matchups).toEqual([]);
    expect(matchups.status).toBe('not-enough-data');
  });

  it('leaves out an unmapped hero id on either side, reports it, and keeps the rest', () => {
    const result = derive([row(0, HULK, 20, 10), row(HULK, 0, 20, 10), row(HULK, THOR, 12, 6)]);

    expect(result.excludedGameIds).toEqual([0]);
    expect(result.matchups.matchups.map((matchup) => matchup.enemy)).toEqual(['thor']);
  });

  it('answers with the designed empty state, and no NaN, when nothing qualifies', () => {
    const result = derive([row(HULK, THOR, 0, 0, { decidedLines: 0 })]);

    expect(result.matchups.status).toBe('not-enough-data');
    expect(result.matchups.matchups).toEqual([]);
    expect(result.matchups.halfSeason?.id).toBe(10.5);
    expect(result.matchups.inPlaceOf).toBeNull();
    expect(result.matchups.minimumMatches).toBe(HERO_MATCHUP_MIN_MATCHES);
    expect(JSON.stringify(result.matchups)).not.toMatch(/NaN|null.*null.*null/);
  });

  it('answers with the empty state before any half-season exists', () => {
    const result = derive([], []);

    expect(result.matchups).toEqual({
      status: 'not-enough-data',
      minimumMatches: HERO_MATCHUP_MIN_MATCHES,
      halfSeason: null,
      inPlaceOf: null,
      matchups: [],
    });
  });

  it('shows the previous half-season, labelled, while the current one has no qualifying matchup', () => {
    const { matchups } = derive([row(HULK, THOR, 12, 6, { halfSeason: 10 }), row(HULK, THOR, 3, 1)]);

    expect(matchups.status).toBe('ready');
    expect(matchups.halfSeason?.id).toBe(10);
    expect(matchups.inPlaceOf?.id).toBe(10.5);
  });

  it('prefers the current half-season once it has a qualifying matchup', () => {
    const { matchups } = derive([row(HULK, THOR, 12, 6, { halfSeason: 10 }), row(HULK, STORM, 10, 5)]);

    expect(matchups.halfSeason?.id).toBe(10.5);
    expect(matchups.inPlaceOf).toBeNull();
    expect(matchups.matchups.map((matchup) => matchup.enemy)).toEqual(['storm']);
  });

  it('stays empty when neither half-season has a qualifying matchup', () => {
    const { matchups } = derive([row(HULK, THOR, 4, 2, { halfSeason: 10 })]);

    expect(matchups.status).toBe('not-enough-data');
    expect(matchups.halfSeason?.id).toBe(10.5);
    expect(matchups.inPlaceOf).toBeNull();
  });
});
