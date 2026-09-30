export type TierName = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface TierListSeason {
  id: number;
  seasonNumber: number;
  half: number;
  subSeason: string;
  label: string;
  name: string;
  description: string;
  halfName: string;
  startTime: string;
  endTime: string;
  sourceTimestamp?: number;
  fetchedAt: string;
}

export interface TierListRankFilter {
  value: string;
  label: string;
}

export interface TierListHero {
  heroId: number;
  name: string;
  role: string;
  imageUrl: string;
  tier: TierName;
  winRate: number;
  pickRate: number;
  banRate: number;
  matches: number;
  wins: number;
  score: number;
}

export interface TierListTier {
  name: TierName;
  heroes: TierListHero[];
}

export interface TierListResponse {
  sourceName: string;
  sourceUrl: string;
  currentSeasonId: number;
  selectedSeasonId: number;
  selectedRankFilter: string;
  seasons: TierListSeason[];
  rankFilters: TierListRankFilter[];
  tiers: TierListTier[];
  updatedAt?: string;
}
