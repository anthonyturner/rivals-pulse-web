import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import type { HeroIdentities } from '../../insights/hero-identity';
import { TIER_NAMES, tierRowsOf, type TierRowView } from '../../insights/tier-list/tier-list-view';

/** The tiers the summary lists, best first. The full tier list shows the rest. */
export const TIER_LIST_TAB_TIERS: readonly TierName[] = ['S', 'A'];

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

  const placed = tierRowsOf(stats, TIER_NAMES, identities).some((row) => row.heroes.length > 0);

  if (stats.status !== 'ready' || !placed) {
    const counted =
      stats.matchesCounted > 0
        ? `${countLabel(stats.matchesCounted, 'match', 'matches')} recorded by RivalsPulse players so far.`
        : 'No match recorded by RivalsPulse players is counted yet.';

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
    footnote: `From ${countLabel(stats.matchesCounted, 'match', 'matches')} of Quick Match and Competitive recorded by RivalsPulse players. A hero's tier comes from its win rate pulled toward 50%, so a short run cannot place it high. Heroes need enough appearances to be placed.`,
    tiers: tierRowsOf(stats, TIER_LIST_TAB_TIERS, identities),
  };
}
