import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';

/** A hero that has appearances but not yet the minimums for a number to be shown. */
export interface HeroProgressRow extends HeroCellView {
  appearances: number;
  progressLabel: string;
  progressPercent: number;
}

/** What a hero needs before it is placed: appearances, and players where the players are counted. */
export interface HeroProgressMinimums {
  matches: number;
  players?: number;
}

export function minimumsOf(stats: Pick<HeroStats, 'minimumMatches' | 'minimumPlayers'>): HeroProgressMinimums {
  return { matches: stats.minimumMatches, players: stats.minimumPlayers };
}

interface HeroProgressEntry {
  hero: string;
  appearances: number;
  players?: number;
}

/**
 * Progress toward the requirement a hero is furthest from meeting: its appearances while it is short
 * of those, and its players once it has the appearances but too few players.
 */
export function heroProgressRow(
  entry: HeroProgressEntry,
  minimums: HeroProgressMinimums,
  identities: HeroIdentities,
): HeroProgressRow {
  const { count, needed, unit } = nextRequirement(entry, minimums);

  return {
    ...heroCell(entry.hero, identities),
    appearances: entry.appearances,
    progressLabel: `${count} of ${needed}${unit}`,
    progressPercent: needed > 0 ? Math.min(100, (count / needed) * 100) : 0,
  };
}

function nextRequirement(
  { appearances, players }: HeroProgressEntry,
  minimums: HeroProgressMinimums,
): { count: number; needed: number; unit: string } {
  if (appearances >= minimums.matches && minimums.players !== undefined && players !== undefined && players < minimums.players) {
    return { count: players, needed: minimums.players, unit: ' players' };
  }

  return { count: appearances, needed: minimums.matches, unit: '' };
}

/** The heroes still short of the minimums, closest first. A hero never seen is left out. */
export function heroProgressRows(
  belowMinimum: readonly HeroProgressEntry[],
  minimums: HeroProgressMinimums,
  identities: HeroIdentities,
): HeroProgressRow[] {
  return belowMinimum
    .filter((entry) => entry.appearances > 0)
    .map((entry) => heroProgressRow(entry, minimums, identities))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));
}
