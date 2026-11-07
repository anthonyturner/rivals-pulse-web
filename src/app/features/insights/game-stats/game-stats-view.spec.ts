import type {
  GameComparison,
  GameSnapshotComparison,
  GameStatsResponse,
  MetricComparison,
  RankComparison,
} from '../../../../contracts/game-stats.model';
import { buildGameStatsView } from './game-stats-view';

const flat: MetricComparison = { previous: 100, change: 0, changePercent: 0, trend: 'flat' };
const sameRank: RankComparison = { previous: '#15', trend: 'flat' };

function comparison(overrides: Partial<GameSnapshotComparison> = {}): GameSnapshotComparison {
  return {
    previousCapturedAt: '2026-11-02T07:10:04.228Z',
    currentPlayers: flat,
    dailyPeak: flat,
    allTimePeak: flat,
    steamDailyRank: sameRank,
    topSellerRank: sameRank,
    read: 'Unused',
    ...overrides,
  };
}

function game(name: string, overrides: Partial<GameComparison> = {}): GameComparison {
  return {
    appId: 1,
    name,
    category: 'Hero shooter',
    currentPlayers: 43194,
    dailyPeak: 118674,
    allTimePeak: 644269,
    steamDailyRank: '#15',
    topSellerRank: '#4',
    twitchViewers: 0,
    reviewSummary: '',
    sourceUrl: 'https://steamdb.info/app/1/charts/',
    ...overrides,
  };
}

function statsOf(games: GameComparison[], overrides: Partial<GameStatsResponse> = {}): GameStatsResponse {
  return {
    snapshotDate: 'November 2, 2026',
    fetchedAt: '2026-11-02T08:51:52.762Z',
    currentPlayerSource: 'Valve',
    currentPlayerSourceUrl: 'https://api.steampowered.com/',
    snapshot: { snapshotDate: 'November 2, 2026', capturedAt: '2026-11-02T08:10:03.826Z', persisted: true },
    previousSnapshot: { snapshotDate: 'November 2, 2026', capturedAt: '2026-11-02T07:10:04.228Z', persisted: true },
    games,
    ...overrides,
  };
}

describe('buildGameStatsView', () => {
  it('writes one row per game with its five figures in column order', () => {
    const view = buildGameStatsView(statsOf([game('Marvel Rivals'), game('Overwatch')]), false);

    expect(view.rows.map((row) => row.name)).toEqual(['Marvel Rivals', 'Overwatch']);
    expect(view.rows[0].category).toBe('Hero shooter');
    expect(view.rows[0].cells.map((cell) => cell.value)).toEqual(['43,194', '118,674', '644,269', '#15', '#4']);
    expect(view.rows[0].cells.map((cell) => cell.kind)).toEqual(['metric', 'metric', 'metric', 'rank', 'rank']);
  });

  it('marks only Marvel Rivals as the row the page is about', () => {
    const view = buildGameStatsView(statsOf([game('Overwatch'), game('Marvel Rivals')]), false);

    expect(view.rows.map((row) => row.subject)).toEqual([false, true]);
  });

  describe('changes since the previous snapshot', () => {
    it('shows none when nothing moved, or when there is nothing to compare with', () => {
      const unchanged = buildGameStatsView(statsOf([game('Marvel Rivals', { comparison: comparison() })]), false);
      const first = buildGameStatsView(statsOf([game('Marvel Rivals')], { previousSnapshot: undefined }), false);

      expect(unchanged.rows[0].cells.map((cell) => cell.delta)).toEqual([null, null, null, null, null]);
      expect(first.rows[0].cells.map((cell) => cell.delta)).toEqual([null, null, null, null, null]);
    });

    it('writes a rise with a plus sign and its percentage, and says it in words', () => {
      const up: MetricComparison = { previous: 39802, change: 3392, changePercent: 8.52, trend: 'up' };
      const view = buildGameStatsView(
        statsOf([game('Marvel Rivals', { comparison: comparison({ currentPlayers: up }) })]),
        false,
      );

      expect(view.rows[0].cells[0].delta).toEqual({
        text: '+3,392 (+8.52%)',
        spoken: 'up 3,392, 8.52 percent',
        trend: 'up',
      });
    });

    it('writes a fall with a real minus sign, never a hyphen', () => {
      const down: MetricComparison = { previous: 100000, change: -7315, changePercent: -25.213, trend: 'down' };
      const view = buildGameStatsView(
        statsOf([game('Overwatch', { comparison: comparison({ dailyPeak: down }) })]),
        false,
      );
      const delta = view.rows[0].cells[1].delta;

      expect(delta?.text).toBe('−7,315 (−25.21%)');
      expect(delta?.text).not.toContain('-');
      expect(delta?.spoken).toBe('down 7,315, 25.21 percent');
      expect(delta?.trend).toBe('down');
    });

    it('leaves the percentage out when the answer has none', () => {
      const up: MetricComparison = { previous: 10, change: 5, trend: 'up' };
      const view = buildGameStatsView(
        statsOf([game('Marvel Rivals', { comparison: comparison({ allTimePeak: up }) })]),
        false,
      );

      expect(view.rows[0].cells[2].delta?.text).toBe('+5');
    });

    it('shows a rank that moved as an arrow and the number of places, with the plural said correctly', () => {
      const view = buildGameStatsView(
        statsOf([
          game('Marvel Rivals', {
            comparison: comparison({
              steamDailyRank: { previous: '#17', positionsChanged: 2, trend: 'up' },
              topSellerRank: { previous: '#3', positionsChanged: -1, trend: 'down' },
            }),
          }),
        ]),
        false,
      );
      const [, , , daily, sellers] = view.rows[0].cells;

      expect(daily.delta).toEqual({ text: '▲2', spoken: 'up 2 places', trend: 'up' });
      expect(sellers.delta).toEqual({ text: '▼1', spoken: 'down 1 place', trend: 'down' });
    });

    it('ignores a change that is not a number', () => {
      const broken: MetricComparison = { previous: 1, change: Number.NaN, trend: 'up' };
      const view = buildGameStatsView(
        statsOf([game('Marvel Rivals', { comparison: comparison({ currentPlayers: broken }) })]),
        false,
      );

      expect(view.rows[0].cells[0].delta).toBeNull();
    });
  });

  describe('the meta line', () => {
    it('names the snapshot, when the live players were fetched and what it is compared with', () => {
      const view = buildGameStatsView(statsOf([game('Marvel Rivals')]), false);

      expect(view.meta).toBe(
        'Snapshot November 2, 2026 · Live players fetched Nov 2, 8:51 AM UTC · Compared with Nov 2, 7:10 AM UTC',
      );
      expect(view.saved).toBeFalse();
    });

    it('says when this is the first stored snapshot', () => {
      const view = buildGameStatsView(statsOf([game('Marvel Rivals')], { previousSnapshot: undefined }), false);

      expect(view.meta).toContain('First stored snapshot; comparisons begin with the next capture');
      expect(view.meta).not.toContain('Compared with');
    });

    it('names a saved snapshot by its date only', () => {
      const view = buildGameStatsView(statsOf([game('Marvel Rivals')], { snapshotDate: 'June 19, 2026' }), true);

      expect(view.meta).toBe('Saved snapshot June 19, 2026');
      expect(view.meta).not.toContain('fetched');
      expect(view.saved).toBeTrue();
      expect(view.snapshotDate).toBe('June 19, 2026');
    });

    it('leaves out a time it cannot read rather than printing Invalid Date', () => {
      const view = buildGameStatsView(statsOf([game('Marvel Rivals')], { fetchedAt: 'not a date' }), false);

      expect(view.meta).not.toContain('Invalid');
      expect(view.meta).not.toContain('fetched');
    });
  });

  it('has no rows when the answer holds no games', () => {
    expect(buildGameStatsView(statsOf([]), false).rows).toEqual([]);
  });
});
