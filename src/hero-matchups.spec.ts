import { HERO_MATCHUP_MIN_MATCHES, deriveHeroMatchups, type HeroMatchupRow } from './hero-matchups';
import { shrunkWinRate } from './hero-stats';

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
  return { halfSeason: 10.5, gameHeroId, enemyGameHeroId, decidedMatches: matches, decidedLines: matches, wins, ...extra };
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
      },
    ]);
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
