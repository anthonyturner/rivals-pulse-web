import type { HeroRole, RoleStatsModeId } from './contracts/role-stats.model';
import { PLAY_MODE_IDS, killDeathAssistRatio, type HeroAggregateRow, type HeroStatsSource } from './hero-stats';
import { ROLE_STATS_MIN_LINES, deriveRoleStats } from './role-stats';

const MIN = ROLE_STATS_MIN_LINES;
const NOW = new Date('2026-10-30T12:00:00Z');
const HULK = 1011;
const CAPTAIN_AMERICA = 1022;
const BLACK_WIDOW = 1033;
const ADAM_WARLOCK = 1046;
const DEADPOOL_VANGUARD = 10571;
const DEADPOOL_DUELIST = 10572;
const ROLES = new Map<number, HeroRole>([
  [HULK, 'Vanguard'],
  [CAPTAIN_AMERICA, 'Vanguard'],
  [BLACK_WIDOW, 'Duelist'],
  [ADAM_WARLOCK, 'Strategist'],
  [DEADPOOL_VANGUARD, 'Vanguard'],
  [DEADPOOL_DUELIST, 'Duelist'],
]);

function row(gameHeroId: number, decidedLines: number, wins: number, extra: Partial<HeroAggregateRow> = {}): HeroAggregateRow {
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

/** A hero row whose K/D/A and final hits were all present on every decided line. */
function fullRow(gameHeroId: number, lines: number, wins: number, perLine: [number, number, number, number], extra: Partial<HeroAggregateRow> = {}): HeroAggregateRow {
  const [kills, deaths, assists, finalHits] = perLine;

  return row(gameHeroId, lines, wins, {
    killsSum: kills * lines,
    killsN: lines,
    deathsSum: deaths * lines,
    deathsN: lines,
    assistsSum: assists * lines,
    assistsN: lines,
    finalHitsSum: finalHits * lines,
    finalHitsN: lines,
    ...extra,
  });
}

function sourceOf(heroes: HeroAggregateRow[], extra: Partial<HeroStatsSource> = {}): HeroStatsSource {
  return {
    halfSeasons: [
      { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
      { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
    ],
    totals: [],
    heroes,
    ...extra,
  };
}

function derive(source: HeroStatsSource, halfSeason?: number) {
  return deriveRoleStats(source, { now: NOW, halfSeason, roleByGameId: ROLES });
}

function roleOf(source: HeroStatsSource, mode: RoleStatsModeId, role: HeroRole, halfSeason?: number) {
  const found = derive(source, halfSeason)
    .stats.modes.find((entry) => entry.id === mode)
    ?.roles.find((entry) => entry.role === role);

  if (found === undefined) {
    throw new Error(`no ${role} in ${mode}`);
  }

  return found;
}

describe('deriveRoleStats role averages', () => {
  it('pools every hero of a role: win rate over decided lines, averages over lines that had the figure', () => {
    const source = sourceOf([
      fullRow(HULK, MIN, MIN / 2, [10, 5, 2, 20]),
      fullRow(CAPTAIN_AMERICA, MIN, MIN / 5, [4, 5, 8, 10]),
    ]);

    const vanguard = roleOf(source, 'competitive', 'Vanguard');

    expect(vanguard.status).toBe('ready');
    expect(vanguard.appearances).toBe(2 * MIN);
    expect(vanguard.winRate).toBeCloseTo(((MIN / 2 + MIN / 5) / (2 * MIN)) * 100, 6);
    expect(vanguard.killsAverage).toBeCloseTo(7, 6);
    expect(vanguard.deathsAverage).toBeCloseTo(5, 6);
    expect(vanguard.assistsAverage).toBeCloseTo(5, 6);
    expect(vanguard.finalHitsAverage).toBeCloseTo(15, 6);
  });

  it('weights each hero by its lines, so a small hero cannot count as much as a big one', () => {
    const source = sourceOf([
      fullRow(HULK, MIN, MIN, [10, 1, 1, 10]),
      fullRow(CAPTAIN_AMERICA, 3 * MIN, 0, [2, 1, 1, 2]),
    ]);
    const vanguard = roleOf(source, 'competitive', 'Vanguard');

    expect(vanguard.winRate).toBe(25);
    expect(vanguard.killsAverage).toBe(4);
    expect(vanguard.finalHitsAverage).toBe(4);
  });

  it('takes KDA as a ratio of the pooled totals, the same definition as the hero numbers', () => {
    const source = sourceOf([
      fullRow(HULK, MIN, 0, [10, 5, 2, 0]),
      fullRow(CAPTAIN_AMERICA, MIN, 0, [4, 5, 8, 0]),
    ]);

    const vanguard = roleOf(source, 'competitive', 'Vanguard');

    expect(vanguard.kda).toBeCloseTo(killDeathAssistRatio(14 * MIN, 10 * MIN, 10 * MIN), 6);
    expect(vanguard.kda).toBeCloseTo(2.4, 6);
  });

  it('divides by one when the role never died, never by zero', () => {
    const source = sourceOf([fullRow(HULK, MIN, 0, [3, 0, 2, 0])]);

    expect(roleOf(source, 'competitive', 'Vanguard').kda).toBe(5 * MIN);
  });

  it('keeps the three roles apart', () => {
    const source = sourceOf([
      fullRow(HULK, MIN, MIN, [1, 1, 1, 1]),
      fullRow(BLACK_WIDOW, MIN, 0, [9, 3, 3, 0]),
      fullRow(ADAM_WARLOCK, MIN, MIN / 2, [2, 4, 12, 0]),
    ]);

    expect(roleOf(source, 'competitive', 'Vanguard').winRate).toBe(100);
    expect(roleOf(source, 'competitive', 'Duelist').winRate).toBe(0);
    expect(roleOf(source, 'competitive', 'Duelist').killsAverage).toBe(9);
    expect(roleOf(source, 'competitive', 'Strategist').assistsAverage).toBe(12);
    expect(derive(source).stats.modes[0].roles.map((entry) => entry.role)).toEqual(['Vanguard', 'Duelist', 'Strategist']);
  });

  it('puts a hero the game splits by role under the role of the id the match reported', () => {
    const source = sourceOf([fullRow(DEADPOOL_VANGUARD, MIN, 0, [1, 1, 1, 0]), fullRow(DEADPOOL_DUELIST, MIN, 0, [1, 1, 1, 0])]);

    expect(roleOf(source, 'competitive', 'Vanguard').appearances).toBe(MIN);
    expect(roleOf(source, 'competitive', 'Duelist').appearances).toBe(MIN);
    expect(roleOf(source, 'competitive', 'Strategist').appearances).toBe(0);
  });
});

describe('deriveRoleStats modes', () => {
  const quick = (heroId: number, lines: number, wins: number) =>
    fullRow(heroId, lines, wins, [1, 1, 1, 1], { playModeId: PLAY_MODE_IDS.quickMatch });

  it('blends Quick Match and Competitive in `all` and leaves Arcade, Practice and unknown out of every mode', () => {
    const source = sourceOf([
      quick(HULK, MIN, MIN),
      fullRow(HULK, MIN, 0, [1, 1, 1, 1], { playModeId: PLAY_MODE_IDS.competitive }),
      fullRow(HULK, MIN, MIN, [1, 1, 1, 1], { playModeId: PLAY_MODE_IDS.arcade }),
      fullRow(HULK, MIN, MIN, [1, 1, 1, 1], { playModeId: PLAY_MODE_IDS.practice }),
      fullRow(HULK, MIN, MIN, [1, 1, 1, 1], { playModeId: PLAY_MODE_IDS.unknown }),
    ]);

    expect(roleOf(source, 'quick-match', 'Vanguard')).toEqual(jasmine.objectContaining({ appearances: MIN, winRate: 100 }));
    expect(roleOf(source, 'competitive', 'Vanguard')).toEqual(jasmine.objectContaining({ appearances: MIN, winRate: 0 }));
    expect(roleOf(source, 'all', 'Vanguard')).toEqual(jasmine.objectContaining({ appearances: 2 * MIN, winRate: 50 }));
  });

  it('always lists the three modes in order, each with every role', () => {
    const { stats } = derive(sourceOf([]));

    expect(stats.modes.map((mode) => [mode.id, mode.label])).toEqual([
      ['all', 'Quick Match and Competitive'],
      ['quick-match', 'Quick Match'],
      ['competitive', 'Competitive'],
    ]);
    expect(stats.modes.every((mode) => mode.roles.length === 3)).toBeTrue();
  });

  it('gates each mode on its own sample, so a thin mode hides while the blend shows', () => {
    const source = sourceOf([quick(HULK, MIN - 1, 0), fullRow(HULK, MIN - 1, 0, [1, 1, 1, 1])]);

    expect(roleOf(source, 'quick-match', 'Vanguard').status).toBe('not-enough-data');
    expect(roleOf(source, 'competitive', 'Vanguard').status).toBe('not-enough-data');
    expect(roleOf(source, 'all', 'Vanguard').status).toBe('ready');
  });
});

describe('deriveRoleStats minimum sample', () => {
  it('shows no figure at all one line under the minimum, and every figure at the minimum', () => {
    const under = roleOf(sourceOf([fullRow(HULK, MIN - 1, MIN - 1, [5, 1, 1, 5])]), 'competitive', 'Vanguard');
    const at = roleOf(sourceOf([fullRow(HULK, MIN, MIN, [5, 1, 1, 5])]), 'competitive', 'Vanguard');

    expect(under).toEqual({
      role: 'Vanguard',
      appearances: MIN - 1,
      status: 'not-enough-data',
      winRate: null,
      killsAverage: null,
      deathsAverage: null,
      assistsAverage: null,
      kda: null,
      finalHitsAverage: null,
    });
    expect(at.status).toBe('ready');
    expect(at.winRate).toBe(100);
    expect(at.kda).toBe(6);
  });

  it('reports not enough data when no role in any mode has the minimum', () => {
    const { stats } = derive(sourceOf([fullRow(HULK, MIN - 1, 0, [1, 1, 1, 1])]));

    expect(stats.status).toBe('not-enough-data');
    expect(stats.minimumLines).toBe(MIN);
  });

  it('is ready as soon as one role in one mode has the minimum', () => {
    expect(derive(sourceOf([fullRow(HULK, MIN, 0, [1, 1, 1, 1])])).stats.status).toBe('ready');
  });

  it('gives no final-hits average from old uploads that never carried it, and never counts them as zero', () => {
    const source = sourceOf([
      fullRow(HULK, MIN, 0, [1, 1, 1, 0], { finalHitsSum: 0, finalHitsN: 0 }),
      fullRow(CAPTAIN_AMERICA, MIN, 0, [1, 1, 1, 0], { finalHitsSum: 8 * MIN, finalHitsN: MIN }),
    ]);
    const vanguard = roleOf(source, 'competitive', 'Vanguard');

    expect(vanguard.finalHitsAverage).toBe(8);

    const none = roleOf(sourceOf([fullRow(HULK, MIN, 0, [1, 1, 1, 0], { finalHitsSum: 0, finalHitsN: 0 })]), 'competitive', 'Vanguard');

    expect(none.status).toBe('ready');
    expect(none.finalHitsAverage).toBeNull();
  });

  it('needs the minimum of lines behind each figure, not only behind the win rate', () => {
    const source = sourceOf([row(HULK, MIN, MIN / 5, { killsSum: MIN, killsN: MIN, deathsSum: MIN, deathsN: MIN - 1, assistsSum: MIN, assistsN: MIN })]);
    const vanguard = roleOf(source, 'competitive', 'Vanguard');

    expect(vanguard.winRate).toBe(20);
    expect(vanguard.killsAverage).toBe(1);
    expect(vanguard.deathsAverage).toBeNull();
    expect(vanguard.kda).toBeNull();
  });

  it('never returns NaN or infinity in any figure', () => {
    const { stats } = derive(sourceOf([row(HULK, MIN, 0), row(BLACK_WIDOW, 0, 0)]));
    const figures = stats.modes
      .flatMap((mode) => mode.roles)
      .flatMap((entry) => [entry.winRate, entry.killsAverage, entry.deathsAverage, entry.assistsAverage, entry.kda, entry.finalHitsAverage]);

    expect(figures.every((figure) => figure === null || Number.isFinite(figure))).toBeTrue();
  });
});

describe('deriveRoleStats heroes with no role', () => {
  it('leaves out a game hero id with no role and reports it, without failing', () => {
    const source = sourceOf([fullRow(HULK, MIN, 0, [1, 1, 1, 1]), fullRow(0, MIN, MIN, [1, 1, 1, 1]), fullRow(9999, MIN, 0, [1, 1, 1, 1])]);
    const { stats, excludedGameIds } = derive(source);

    expect(excludedGameIds).toEqual([0, 9999]);
    expect(stats.modes[0].roles.reduce((sum, entry) => sum + entry.appearances, 0)).toBe(MIN);
  });
});

describe('deriveRoleStats half-seasons', () => {
  const older = (heroId: number, lines: number) => fullRow(heroId, lines, 0, [1, 1, 1, 1], { halfSeason: 10 });

  it('shows the current half-season with its dates', () => {
    const { stats } = derive(sourceOf([fullRow(HULK, MIN, 0, [1, 1, 1, 1]), older(HULK, MIN * 2)]));

    expect(stats.halfSeason).toEqual({
      id: 10.5,
      label: 'Season 10.5',
      startsAt: '2026-10-09T09:00:00Z',
      endsAt: null,
    });
    expect(stats.inPlaceOf).toBeNull();
    expect(stats.halfSeasons.map((season) => season.id)).toEqual([10, 10.5]);
    expect(roleOf(sourceOf([fullRow(HULK, MIN, 0, [1, 1, 1, 1]), older(HULK, MIN * 2)]), 'all', 'Vanguard').appearances).toBe(MIN);
  });

  it('shows the previous half-season, labelled, while the current one has no ready role', () => {
    const { stats } = derive(sourceOf([fullRow(HULK, MIN - 1, 0, [1, 1, 1, 1]), older(HULK, MIN)]));

    expect(stats.status).toBe('ready');
    expect(stats.halfSeason?.id).toBe(10);
    expect(stats.inPlaceOf?.id).toBe(10.5);
  });

  it('reports not enough data for the current half-season when neither has a ready role', () => {
    const { stats } = derive(sourceOf([fullRow(HULK, MIN - 1, 0, [1, 1, 1, 1]), older(HULK, MIN - 1)]));

    expect(stats.status).toBe('not-enough-data');
    expect(stats.halfSeason?.id).toBe(10.5);
    expect(stats.inPlaceOf).toBeNull();
  });

  it("shows exactly the half-season asked for, with no fall-back, and none for one that does not exist", () => {
    const source = sourceOf([fullRow(HULK, MIN - 1, 0, [1, 1, 1, 1]), older(HULK, MIN)]);

    expect(roleOf(source, 'all', 'Vanguard', 10).appearances).toBe(MIN);
    expect(derive(source, 10).stats.inPlaceOf).toBeNull();
    expect(derive(source, 10.5).stats.status).toBe('not-enough-data');
    expect(derive(source, 11).stats.halfSeason).toBeNull();
    expect(derive(source, NaN).stats.status).toBe('not-enough-data');
  });

  it('is a designed empty state with no half-season at all', () => {
    const { stats } = derive({ halfSeasons: [], totals: [], heroes: [] });

    expect(stats.status).toBe('not-enough-data');
    expect(stats.halfSeason).toBeNull();
    expect(stats.halfSeasons).toEqual([]);
    expect(stats.modes.every((mode) => mode.roles.every((entry) => entry.appearances === 0 && entry.winRate === null))).toBeTrue();
  });
});
