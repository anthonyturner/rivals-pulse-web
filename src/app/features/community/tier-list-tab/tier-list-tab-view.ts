import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import type { CommunityHeroRow } from '../community-hero-list/community-hero-list.component';

/** The tiers the summary lists, best first. The full tier list shows the rest. */
export const TIER_LIST_TAB_TIERS: readonly TierName[] = ['S', 'A'];

export interface TierView {
  name: TierName;
  heroes: CommunityHeroRow[];
}

export type TierListTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      matchesLabel: string;
      tiers: TierView[];
    };

/**
 * What the Tier list tab shows: the top tiers as the hero stats place them, strongest shrunk win
 * rate first. `undefined` means the stats have not answered yet and `null` means they could not be
 * read; neither is "not enough data", which is a real answer.
 */
export function buildTierListTabView(
  stats: HeroStats | null | undefined,
  identities: HeroIdentities,
): TierListTabView {
  if (stats === undefined) {
    return { kind: 'loading' };
  }

  if (stats === null) {
    return { kind: 'unavailable' };
  }

  const placed = stats.tiers.flatMap((tier) => tier.heroes).filter(isReadable);

  if (stats.status !== 'ready' || placed.length === 0) {
    const counted =
      stats.matchesCounted > 0
        ? `${countLabel(stats.matchesCounted, 'match', 'matches')} recorded by Rivals Pulse players so far.`
        : 'No match recorded by Rivals Pulse players is counted yet.';

    return {
      kind: 'not-enough-data',
      summary: `${counted} A hero is placed in a tier at ${countLabel(stats.minimumMatches, 'appearance', 'appearances')}.`,
    };
  }

  const halfSeasonLabel = stats.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, halfSeasonLabel),
    matchesLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
    tiers: TIER_LIST_TAB_TIERS.map((name) => ({
      name,
      heroes: stats.tiers
        .filter((tier) => tier.name === name)
        .flatMap((tier) => tier.heroes)
        .filter(isReadable)
        .sort(
          (a, b) =>
            b.shrunkWinRate - a.shrunkWinRate ||
            b.appearances - a.appearances ||
            a.hero.localeCompare(b.hero),
        )
        .map((line) => ({
          ...heroCell(line.hero, identities),
          figure: percentLabel(line.winRate),
          sample: `${percentLabel(line.pickRate)} pick rate, ${countLabel(line.appearances, 'appearance', 'appearances')}`,
        })),
    })),
  };
}

function isReadable(line: HeroStatsHero): boolean {
  return (
    line.appearances > 0 &&
    Number.isFinite(line.winRate) &&
    Number.isFinite(line.pickRate) &&
    Number.isFinite(line.shrunkWinRate)
  );
}
