import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroCellView, type HeroIdentities } from '../../insights/hero-identity';

/** How many heroes a tab lists. A hero short of the minimum does not take one of these. */
export const SNAPSHOT_SLOTS = 5;

export const SNAPSHOT_TABS = [
  { id: 'all', label: 'All', role: null },
  { id: 'vanguard', label: 'Vanguard', role: 'Vanguard' },
  { id: 'duelist', label: 'Duelist', role: 'Duelist' },
  { id: 'strategist', label: 'Strategist', role: 'Strategist' },
] as const;

export type SnapshotTabId = (typeof SNAPSHOT_TABS)[number]['id'];

const TIER_NAMES: readonly string[] = ['S', 'A', 'B', 'C', 'D', 'F'];

export interface SnapshotRowView extends HeroCellView {
  /** Null for a hero with no tier, which shows no badge at all. */
  tier: TierName | null;
  winRateLabel: string;
  /** Which side of an even 50% the win rate is on, so the cue is never colour alone. */
  winRateSide: 'above' | 'below' | 'even';
  pickRateLabel: string;
  appearancesLabel: string;
}

export interface SnapshotPanelView {
  id: SnapshotTabId;
  label: string;
  rows: SnapshotRowView[];
  /** What the panel says when it has no rows. */
  emptyMessage: string;
}

export type StatsSnapshotView =
  | {
      /** The numbers could not be read. */
      kind: 'unavailable';
      message: string;
    }
  | {
      kind: 'ready';
      /** The half-season the stats describe, or null before any half-season exists. */
      halfSeasonLabel: string | null;
      /** The sample behind the figures, always shown under the table. */
      sample: string;
      fallbackNotice: string | null;
      panels: SnapshotPanelView[];
    };

/**
 * The heroes with the most picks among those that reached the minimum, split by role. Each tab
 * carries its own empty message, so a tab with no qualifying hero explains itself and never prints
 * a zero. `stats` is null when the numbers could not be read.
 */
export function buildStatsSnapshotView(stats: HeroStats | null, identities: HeroIdentities): StatsSnapshotView {
  if (stats === null) {
    return { kind: 'unavailable', message: 'Hero stats cannot be loaded right now. The rest of the page is not affected.' };
  }

  const listed = stats.tiers
    .flatMap((tier) => tier.heroes.map((line) => ({ line, tier: tier.name })))
    .filter(({ line }) => isReadable(line))
    .map(({ line, tier }) => ({ line, row: rowOf(line, tier, identities) }))
    .sort(
      (a, b) =>
        b.line.pickRate - a.line.pickRate ||
        b.line.appearances - a.line.appearances ||
        a.row.name.localeCompare(b.row.name),
    );
  const minimum = countLabel(stats.minimumMatches, 'appearance', 'appearances');
  const halfSeasonLabel = stats.halfSeason?.label ?? null;
  const counted =
    Number.isFinite(stats.matchesCounted) && stats.matchesCounted > 0
      ? `From ${countLabel(stats.matchesCounted, 'match', 'matches')} by Rivals Pulse players. `
      : 'From matches recorded by Rivals Pulse players. ';

  return {
    kind: 'ready',
    halfSeasonLabel,
    sample: `${counted}Only heroes with at least ${minimum} are listed.`,
    fallbackNotice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, halfSeasonLabel),
    panels: SNAPSHOT_TABS.map((tab): SnapshotPanelView => {
      const rows = listed
        .filter(({ row }) => tab.role === null || row.role === tab.role)
        .slice(0, SNAPSHOT_SLOTS)
        .map(({ row }) => row);

      return {
        id: tab.id,
        label: tab.label,
        rows,
        emptyMessage: emptyMessageOf(tab.role, minimum, identities.size > 0),
      };
    }),
  };
}

function emptyMessageOf(role: string | null, minimum: string, rolesKnown: boolean): string {
  if (role === null) {
    return `Stats appear once enough matches are uploaded. A hero is listed after ${minimum}.`;
  }

  if (!rolesKnown) {
    return 'Heroes cannot be split by role right now, because the hero list could not be loaded. The All tab is not affected.';
  }

  return `Not enough ${role} data yet. A hero appears after ${minimum}.`;
}

function rowOf(line: HeroStatsHero, tier: string, identities: HeroIdentities): SnapshotRowView {
  return {
    ...heroCell(line.hero, identities),
    tier: TIER_NAMES.includes(tier) ? (tier as TierName) : null,
    winRateLabel: percentLabel(line.winRate),
    winRateSide: line.winRate > 50 ? 'above' : line.winRate < 50 ? 'below' : 'even',
    pickRateLabel: percentLabel(line.pickRate),
    appearancesLabel: line.appearances.toLocaleString('en-US'),
  };
}

/** A line whose figures are not finite is left out: "NaN%" is never printed. */
function isReadable(line: HeroStatsHero): boolean {
  return line.appearances > 0 && Number.isFinite(line.winRate) && Number.isFinite(line.pickRate);
}
