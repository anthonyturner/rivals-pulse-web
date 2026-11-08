import type { HeroMatchupRow } from '../matchups/hero-matchups';
import { deriveHeroSwitchIns, SWITCH_IN_MIN_MATCHES, SWITCH_IN_MIN_PLAYERS, type HeroSwitchInRow } from './hero-switch-ins';

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

function row(
  gameHeroId: number,
  enemyGameHeroId: number,
  matches: number,
  wins: number,
  extra: Partial<HeroSwitchInRow> = {},
): HeroSwitchInRow {
  return { halfSeason: 10.5, gameHeroId, enemyGameHeroId, decidedMatches: matches, decidedSwitches: matches, wins, ...extra };
}

function matchup(
  gameHeroId: number,
  enemyGameHeroId: number,
  matches: number,
  wins: number,
  extra: Partial<HeroMatchupRow> = {},
): HeroMatchupRow {
  return { halfSeason: 10.5, gameHeroId, enemyGameHeroId, decidedMatches: matches, decidedLines: matches, wins, ...extra };
}

function derive(rows: HeroSwitchInRow[], matchups: HeroMatchupRow[] = [], seasons = SEASONS) {
  return deriveHeroSwitchIns(rows, matchups, seasons, { now: NOW, heroSlugByGameId: SLUGS });
}

describe('deriveHeroSwitchIns', () => {
  it('states the minimums the database applies: 10 matches from 2 players', () => {
    expect(SWITCH_IN_MIN_MATCHES).toBe(10);
    expect(SWITCH_IN_MIN_PLAYERS).toBe(2);
  });

  it('names the hero switched to and the enemy, with the rate over switches, not matches', () => {
    const { switchIns } = derive([row(HULK, THOR, 12, 9, { decidedSwitches: 16 })]);

    expect(switchIns.status).toBe('ready');
    expect(switchIns.minimumMatches).toBe(SWITCH_IN_MIN_MATCHES);
    expect(switchIns.minimumPlayers).toBe(SWITCH_IN_MIN_PLAYERS);
    expect(switchIns.switchIns).toEqual([
      { hero: 'hulk', enemy: 'thor', matches: 12, switches: 16, wins: 9, winRate: 56.25, overall: null },
    ]);
  });

  it("sets each switch-in beside the hero's overall record against that enemy", () => {
    const { switchIns } = derive([row(HULK, THOR, 12, 5)], [matchup(HULK, THOR, 40, 26, { decidedLines: 50 })]);

    expect(switchIns.switchIns[0].overall).toEqual({ matches: 40, appearances: 50, wins: 26, winRate: 52 });
  });

  it('leaves the comparison empty, not zero, where that matchup has too few matches or is in another half-season', () => {
    const { switchIns } = derive(
      [row(HULK, THOR, 12, 5), row(HULK, STORM, 12, 5)],
      [matchup(HULK, THOR, 4, 2), matchup(HULK, STORM, 30, 15, { halfSeason: 10 })],
    );

    expect(switchIns.switchIns.map((line) => line.overall)).toEqual([null, null]);
  });

  it('lists a pairing only once it has the minimum number of matches', () => {
    const { switchIns } = derive([row(HULK, THOR, SWITCH_IN_MIN_MATCHES - 1, 6), row(HULK, STORM, SWITCH_IN_MIN_MATCHES, 4)]);

    expect(switchIns.switchIns.map((line) => line.enemy)).toEqual(['storm']);
  });

  it('sorts by hero and then enemy, never by strength', () => {
    const { switchIns } = derive([row(THOR, HULK, 10, 10), row(HULK, THOR, 10, 0), row(HULK, STORM, 10, 5)]);

    expect(switchIns.switchIns.map((line) => `${line.hero}>${line.enemy}`)).toEqual(['hulk>storm', 'hulk>thor', 'thor>hulk']);
  });

  it('counts every Deadpool id as the one hero and sums their rows', () => {
    const { switchIns } = derive([row(10571, THOR, 6, 4), row(10572, THOR, 5, 2), row(THOR, 1057, 11, 7)]);

    expect(switchIns.switchIns.map((line) => [line.hero, line.enemy, line.matches, line.wins])).toEqual([
      ['deadpool', 'thor', 11, 6],
      ['thor', 'deadpool', 11, 7],
    ]);
  });

  it('drops a hero against itself, including one Deadpool form against another', () => {
    const { switchIns } = derive([row(HULK, HULK, 12, 6), row(10571, 10572, 12, 6)]);

    expect(switchIns.switchIns).toEqual([]);
    expect(switchIns.status).toBe('not-enough-data');
  });

  it('leaves out an unmapped hero id on either side, reports it, and keeps the rest', () => {
    const result = derive([row(0, HULK, 20, 10), row(HULK, 0, 20, 10), row(HULK, THOR, 12, 6)]);

    expect(result.excludedGameIds).toEqual([0]);
    expect(result.switchIns.switchIns.map((line) => line.enemy)).toEqual(['thor']);
  });

  it('answers with the empty state before any half-season exists', () => {
    expect(derive([], [], []).switchIns).toEqual({
      status: 'not-enough-data',
      minimumMatches: SWITCH_IN_MIN_MATCHES,
      minimumPlayers: SWITCH_IN_MIN_PLAYERS,
      halfSeason: null,
      inPlaceOf: null,
      switchIns: [],
    });
  });

  it('answers with the empty state, and no NaN, when nothing qualifies', () => {
    const { switchIns } = derive([row(HULK, THOR, 0, 0, { decidedSwitches: 0 })]);

    expect(switchIns.status).toBe('not-enough-data');
    expect(switchIns.halfSeason?.id).toBe(10.5);
    expect(JSON.stringify(switchIns)).not.toMatch(/NaN/);
  });

  it('shows the previous half-season, labelled, while the current one has no pairing at the minimum', () => {
    const { switchIns } = derive([row(HULK, THOR, 12, 6, { halfSeason: 10 }), row(HULK, THOR, 3, 1)]);

    expect(switchIns.status).toBe('ready');
    expect(switchIns.halfSeason?.id).toBe(10);
    expect(switchIns.inPlaceOf?.id).toBe(10.5);
  });

  it('compares with the matchups of the half-season it shows', () => {
    const { switchIns } = derive(
      [row(HULK, THOR, 12, 6, { halfSeason: 10 })],
      [matchup(HULK, THOR, 20, 12, { halfSeason: 10 }), matchup(HULK, THOR, 30, 3)],
    );

    expect(switchIns.halfSeason?.id).toBe(10);
    expect(switchIns.switchIns[0].overall?.matches).toBe(20);
  });

  it('prefers the current half-season once it has a pairing', () => {
    const { switchIns } = derive([row(HULK, THOR, 12, 6, { halfSeason: 10 }), row(HULK, STORM, 10, 5)]);

    expect(switchIns.halfSeason?.id).toBe(10.5);
    expect(switchIns.inPlaceOf).toBeNull();
    expect(switchIns.switchIns.map((line) => line.enemy)).toEqual(['storm']);
  });
});
