import type { HeroStats } from './contracts/hero-stats.model.js';
import { getHeroStats } from './hero-stats-read.js';

/** What `/api/content/status` reports about the community hero numbers; no hero or player is named. */
export interface CommunityHeroStatsStatus {
  /** `unavailable` means the aggregates could not be read, not that there is no data. */
  status: HeroStats['status'] | 'unavailable';
  /** The half-season the numbers come from, such as 10.5, or null before any half-season exists. */
  halfSeason: number | null;
  /** Set when that half-season stands in for the current one, which has not reached the minimum yet. */
  inPlaceOf: number | null;
  matchesCounted: number;
  /** Heroes with enough appearances to be placed in a tier. */
  heroesPlaced: number;
}

export function communityHeroStatsStatus(stats: HeroStats): CommunityHeroStatsStatus {
  return {
    status: stats.status,
    halfSeason: stats.halfSeason?.id ?? null,
    inPlaceOf: stats.inPlaceOf?.id ?? null,
    matchesCounted: stats.matchesCounted,
    heroesPlaced: stats.tiers.reduce((sum, tier) => sum + tier.heroes.length, 0),
  };
}

/** The status of the live aggregates. A failed read is reported, never thrown, so the status page still answers. */
export async function readCommunityHeroStatsStatus(): Promise<CommunityHeroStatsStatus> {
  try {
    return communityHeroStatsStatus(await getHeroStats());
  } catch {
    return { status: 'unavailable', halfSeason: null, inPlaceOf: null, matchesCounted: 0, heroesPlaced: 0 };
  }
}
