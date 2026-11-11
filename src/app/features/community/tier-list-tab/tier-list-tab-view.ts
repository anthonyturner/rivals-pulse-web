import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { decidedMatchesLabel, halfSeasonFallbackNotice, placementRequirementLabel } from '../../../shared/utilities/stat-labels';
import type { HeroIdentities } from '../../insights/hero-identity';
import { TIER_NAMES, tierRowsOf, type TierRowView } from '../../insights/tier-list/tier-list-view';

/** How many tiers the summary lists: the best ones that have a hero. The full tier list shows the rest. */
export const TIER_LIST_TAB_TIER_COUNT = 2;

export type TierListTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      /** The caveat under the tiers: the sample, and how a hero is placed. */
      footnote: string;
      tiers: TierRowView[];
    };

/**
 * What the Tier list tab shows: the two best tiers that have a hero, as the hero stats place them,
 * strongest shrunk win rate first. `undefined` means the stats have not answered yet and `null` means they could not be
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

  const tiers = tierRowsOf(stats, TIER_NAMES, identities).slice(0, TIER_LIST_TAB_TIER_COUNT);

  if (stats.status !== 'ready' || tiers.length === 0) {
    const counted =
      stats.matchesCounted > 0
        ? `${decidedMatchesLabel(stats.matchesCounted)} recorded by RivalsPulse players so far.`
        : 'No match recorded by RivalsPulse players is counted yet.';

    return {
      kind: 'not-enough-data',
      summary: `${counted} A hero is placed in a tier at ${placementRequirementLabel(stats)}.`,
    };
  }

  const halfSeasonLabel = stats.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, halfSeasonLabel),
    footnote: `From ${decidedMatchesLabel(stats.matchesCounted)} in Quick Match and Competitive, recorded by RivalsPulse players. A hero's tier comes from its win rate pulled toward the average of its role, by about as much as 60 more matches would, so a short run cannot place it high. Heroes need enough appearances and players to be placed.`,
    tiers,
  };
}
