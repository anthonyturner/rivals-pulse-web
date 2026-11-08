import { TEAM_LINEUP_MIN_TEAMS, deriveTeamLineups, type TeamLineupRow } from './team-lineups';

const NOW = new Date('2026-11-07T12:00:00Z');
const SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];

/** One row of `read_team_lineup_shapes()` for a shape; the team counts are the half-season's. */
function row(
  shape: [number, number, number] | null,
  teams: number | null,
  wins: number | null,
  extra: Partial<TeamLineupRow> = {},
): TeamLineupRow {
  return {
    halfSeason: 10.5,
    rankBucket: -1,
    shape: shape === null ? null : { vanguards: shape[0], duelists: shape[1], strategists: shape[2] },
    teams,
    wins,
    enoughData: teams !== null,
    classifiedTeams: 1000,
    unclassifiedTeams: 40,
    ...extra,
  };
}

function derive(rows: TeamLineupRow[]) {
  return deriveTeamLineups(rows, { halfSeasons: SEASONS }, NOW);
}

describe('deriveTeamLineups', () => {
  it('names a shape by its Vanguard-Duelist-Strategist counts and computes its pick rate and win rate', () => {
    const lineups = derive([row([1, 2, 3], 250, 100), row([2, 2, 2], 600, 330)]);

    expect(lineups.status).toBe('ready');
    expect(lineups.minimumTeams).toBe(TEAM_LINEUP_MIN_TEAMS);
    expect(lineups.halfSeason?.id).toBe(10.5);
    expect(lineups.shapes).toEqual([
      { shape: '2-2-2', vanguards: 2, duelists: 2, strategists: 2, status: 'ready', teams: 600, wins: 330, pickRate: 0.6, winRate: 0.55 },
      { shape: '1-2-3', vanguards: 1, duelists: 2, strategists: 3, status: 'ready', teams: 250, wins: 100, pickRate: 0.25, winRate: 0.4 },
    ]);
  });

  it('counts the unclassified teams without putting them in a shape or in the pick rate denominator', () => {
    const lineups = derive([row([2, 2, 2], 400, 200, { classifiedTeams: 800, unclassifiedTeams: 55 })]);

    expect(lineups.classifiedTeams).toBe(800);
    expect(lineups.unclassifiedTeams).toBe(55);
    expect(lineups.shapes[0].pickRate).toBe(0.5);
  });

  it('lists a shape under the minimum as not enough data, with no figures, after the shapes that have them', () => {
    const lineups = derive([row([3, 2, 1], null, null), row([2, 2, 2], 400, 200), row([1, 2, 3], 199, 90)]);

    expect(lineups.shapes.map((shape) => [shape.shape, shape.status, shape.teams, shape.winRate])).toEqual([
      ['2-2-2', 'ready', 400, 0.5],
      ['1-2-3', 'not-enough-data', null, null],
      ['3-2-1', 'not-enough-data', null, null],
    ]);
  });

  it('withholds figures the database sent for a shape under the minimum', () => {
    const lineups = derive([row([2, 2, 2], 400, 200), row([1, 2, 3], 199, 90, { enoughData: true })]);

    expect(lineups.shapes[1]).toEqual(jasmine.objectContaining({ status: 'not-enough-data', teams: null, wins: null, pickRate: null }));
  });

  it('is the empty state, with the unclassified teams still counted, when no shape reaches the minimum', () => {
    const lineups = derive([row([2, 2, 2], null, null)]);

    expect(lineups.status).toBe('not-enough-data');
    expect(lineups.unclassifiedTeams).toBe(40);
  });

  it('keeps the unclassified teams when a half-season has no classified team at all', () => {
    const lineups = derive([row(null, null, null, { classifiedTeams: 0, unclassifiedTeams: 12 })]);

    expect(lineups.status).toBe('not-enough-data');
    expect(lineups.shapes).toEqual([]);
    expect(lineups.unclassifiedTeams).toBe(12);
  });

  it('answers the empty state when there are no rows', () => {
    const lineups = derive([]);

    expect(lineups.status).toBe('not-enough-data');
    expect(lineups.shapes).toEqual([]);
    expect(lineups.halfSeason?.id).toBe(10.5);
  });

  it('shows the previous half-season, and says so, while the current one has no shape at the minimum', () => {
    const lineups = derive([
      row([2, 2, 2], 500, 250, { halfSeason: 10, classifiedTeams: 1000 }),
      row([2, 2, 2], null, null, { halfSeason: 10.5 }),
    ]);

    expect(lineups.halfSeason?.id).toBe(10);
    expect(lineups.inPlaceOf?.id).toBe(10.5);
    expect(lineups.status).toBe('ready');
  });

  it('builds the figures from rows with no rank only, never by adding rank buckets', () => {
    const lineups = derive([row([2, 2, 2], 400, 200), row([2, 2, 2], 900, 900, { rankBucket: 3 })]);

    expect(lineups.shapes.map((shape) => shape.teams)).toEqual([400]);
  });

  it('gives a rate of 0, not NaN, when there is nothing to divide by', () => {
    const lineups = derive([row([2, 2, 2], 400, 0, { classifiedTeams: 0 })]);

    expect(lineups.shapes[0].pickRate).toBe(0);
    expect(lineups.shapes[0].winRate).toBe(0);
  });
});
