import type { GameCounts } from '../../../../contracts/game-counts.model';
import { buildGameStatsView } from './game-stats-view';

const COUNTS: GameCounts = {
  matches: 1234,
  players: 56789,
  since: '2026-09-20T02:12:49.000Z',
  halfSeasons: [
    { halfSeason: 10.5, matches: 900, players: 40000 },
    { halfSeason: 10, matches: 334, players: 20000 },
  ],
};

describe('buildGameStatsView', () => {
  it('is loading while the request runs and an error once it has failed', () => {
    expect(buildGameStatsView(undefined)).toEqual({ status: 'loading' });
    expect(buildGameStatsView(null)).toEqual({ status: 'error' });
  });

  it('is empty before any match is recorded, whatever else the answer carries', () => {
    expect(buildGameStatsView({ matches: 0, players: 0, since: null, halfSeasons: [] })).toEqual({ status: 'empty' });
  });

  it('formats the totals as tiles and the earliest match as a UTC date', () => {
    const view = buildGameStatsView(COUNTS);

    expect(view).toEqual(
      jasmine.objectContaining({
        status: 'ready',
        meta: 'Counted from RivalsPulse overlay uploads: what the app has recorded, not everyone who plays Marvel Rivals.',
        tiles: [
          { label: 'Matches · all seasons', value: '1,234' },
          { label: 'Matches · Season 10.5', value: '900' },
          { label: 'Players', value: '56,789' },
          { label: 'Earliest match', value: 'Sep 20, 2026' },
        ],
      }),
    );
  });

  it('names each half-season a season and charts them oldest first, so the chart reads forward in time', () => {
    const view = buildGameStatsView(COUNTS);

    expect(view.status === 'ready' && view.seasons.map((season) => [season.label, season.cells.map((cell) => cell?.valueLabel)])).toEqual([
      ['Season 10', ['334', '20,000']],
      ['Season 10.5', ['900', '40,000']],
    ]);
  });

  it('scales matches and players each to their own largest half-season', () => {
    const view = buildGameStatsView(COUNTS);
    const positions = view.status === 'ready' ? view.seasons.map((season) => season.cells.map((cell) => cell?.position)) : [];

    expect(positions[1]).toEqual([100, 100]);
    expect(positions[0]?.[0]).toBeCloseTo((334 / 900) * 100);
    expect(positions[0]?.[1]).toBeCloseTo(50);
  });

  it('prints a figure over each bar only while the half-seasons are few enough to fit them', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ halfSeason: 10 + index / 2, matches: 10, players: 5 }));

    expect(buildGameStatsView(COUNTS)).toEqual(jasmine.objectContaining({ showSeasonValues: true }));
    expect(buildGameStatsView({ ...COUNTS, halfSeasons: many })).toEqual(jasmine.objectContaining({ showSeasonValues: false }));
  });

  it('keeps a half-season with no matches on the chart as an empty bar, never NaN', () => {
    const view = buildGameStatsView({ ...COUNTS, matches: 5, halfSeasons: [{ halfSeason: 10, matches: 0, players: 0 }] });

    expect(view.status === 'ready' && view.seasons[0].cells).toEqual([
      { position: 0, valueLabel: '0' },
      { position: 0, valueLabel: '0' },
    ]);
  });

  it('says "Match" for a figure of exactly one', () => {
    const view = buildGameStatsView({ ...COUNTS, matches: 1, halfSeasons: [{ halfSeason: 10.5, matches: 1, players: 1 }] });

    expect(view.status === 'ready' && view.tiles[0].label).toBe('Match · all seasons');
  });

  it('leaves out the earliest match when the answer has no start time', () => {
    const view = buildGameStatsView({ ...COUNTS, since: null });

    expect(view.status === 'ready' && view.tiles.map((tile) => tile.label)).toEqual([
      'Matches · all seasons',
      'Matches · Season 10.5',
      'Players',
    ]);
  });

  it('states no separate half-season figure while one half-season is all there is', () => {
    const view = buildGameStatsView({ ...COUNTS, matches: 900, halfSeasons: [COUNTS.halfSeasons[0]] });

    expect(view.status === 'ready' && view.tiles.map((tile) => tile.label)).toEqual([
      'Matches · all seasons',
      'Players',
      'Earliest match',
    ]);
  });
});
