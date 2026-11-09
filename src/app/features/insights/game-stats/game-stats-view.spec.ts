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
        meta: 'Counted from RivalsPulse overlay uploads since Sep 20, 2026',
        tiles: [
          { label: 'Matches seen', value: '1,234' },
          { label: 'Players seen', value: '56,789' },
          { label: 'Earliest match', value: 'Sep 20, 2026' },
        ],
      }),
    );
  });

  it('names each half-season a season and keeps the answer newest first', () => {
    const view = buildGameStatsView(COUNTS);

    expect(view.status === 'ready' && view.rows).toEqual([
      { label: 'Season 10.5', matches: '900', players: '40,000' },
      { label: 'Season 10', matches: '334', players: '20,000' },
    ]);
  });

  it('leaves out the earliest match when the answer has no start time', () => {
    const view = buildGameStatsView({ ...COUNTS, since: null });

    expect(view.status === 'ready' && view.tiles.map((tile) => tile.label)).toEqual(['Matches seen', 'Players seen']);
    expect(view.status === 'ready' && view.meta).toBe('Counted from RivalsPulse overlay uploads');
  });
});
