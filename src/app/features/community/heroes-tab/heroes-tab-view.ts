import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import type { CommunityHeroRow } from '../community-hero-list/community-hero-list.component';

/** Heroes listed under each heading: a summary, not the full table on the win-rates page. */
export const HEROES_TAB_LEADERS = 5;

export type HeroesTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      matchesLabel: string;
      mostPicked: CommunityHeroRow[];
      highestWinRate: CommunityHeroRow[];
    };

/**
 * What the Heroes tab shows: the leaders among the heroes that have reached the minimum, with the
 * same figures and the same order as the win-rates page. `undefined` means the stats have not
 * answered yet and `null` means they could not be read; neither is "not enough data", which is a
 * real answer.
 */
export function buildHeroesTabView(
  stats: HeroStats | null | undefined,
  identities: HeroIdentities,
): HeroesTabView {
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
      summary: `${counted} A hero's numbers appear at ${countLabel(stats.minimumMatches, 'appearance', 'appearances')}.`,
    };
  }

  const halfSeasonLabel = stats.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, halfSeasonLabel),
    matchesLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
    mostPicked: leaders(placed, 'pickRate', identities),
    highestWinRate: leaders(placed, 'winRate', identities),
  };
}

function leaders(
  placed: readonly HeroStatsHero[],
  rate: 'pickRate' | 'winRate',
  identities: HeroIdentities,
): CommunityHeroRow[] {
  return placed
    .map((line) => ({ line, cell: heroCell(line.hero, identities) }))
    .sort(
      (a, b) =>
        b.line[rate] - a.line[rate] ||
        b.line.appearances - a.line.appearances ||
        a.cell.name.localeCompare(b.cell.name),
    )
    .slice(0, HEROES_TAB_LEADERS)
    .map(({ line, cell }) => ({
      ...cell,
      figure: percentLabel(line[rate]),
      sample: countLabel(line.appearances, 'appearance', 'appearances'),
    }));
}

/** A line whose figures are not finite is left out: "NaN%" is never printed. */
function isReadable(line: HeroStatsHero): boolean {
  return line.appearances > 0 && Number.isFinite(line.winRate) && Number.isFinite(line.pickRate);
}
