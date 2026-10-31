export type SnapshotTrend = 'up' | 'down' | 'flat';

export interface MetricComparison {
  previous: number;
  change: number;
  changePercent?: number;
  trend: SnapshotTrend;
}

export interface RankComparison {
  previous: string;
  positionsChanged?: number;
  trend: SnapshotTrend;
}

export interface GameSnapshotComparison {
  previousCapturedAt: string;
  currentPlayers: MetricComparison;
  dailyPeak: MetricComparison;
  allTimePeak: MetricComparison;
  steamDailyRank: RankComparison;
  topSellerRank: RankComparison;
  read: string;
}

export interface GameComparison {
  appId: number;
  name: string;
  category: string;
  currentPlayers: number;
  dailyPeak: number;
  allTimePeak: number;
  steamDailyRank: string;
  topSellerRank: string;
  twitchViewers: number;
  reviewSummary: string;
  sourceUrl: string;
  comparison?: GameSnapshotComparison;
}

export interface GameStatsSnapshotReference {
  id?: number;
  snapshotDate: string;
  capturedAt: string;
  persisted: boolean;
}

export interface GameStatsResponse {
  snapshotDate: string;
  fetchedAt: string;
  currentPlayerSource: string;
  currentPlayerSourceUrl: string;
  snapshot: GameStatsSnapshotReference;
  previousSnapshot?: GameStatsSnapshotReference;
  games: GameComparison[];
}
