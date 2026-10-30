import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';

export interface HeroCommunityFigure {
  label: string;
  value: string;
}

export type HeroCommunityStatsView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The current half-season this one stands in for, or null when this is the current one. */
      fallbackFor: string | null;
      matchesCounted: number;
      appearances: number;
      figures: HeroCommunityFigure[];
    }
  | {
      kind: 'not-enough-data';
      halfSeasonLabel: string | null;
      fallbackFor: string | null;
      /** Appearances so far in the half-season shown; 0 when no recorded match has this hero. */
      appearances: number;
      minimumMatches: number;
    };

const NOT_RECORDED = 'Not recorded';

/**
 * What a hero page shows for one hero. `undefined` means the stats have not answered yet and `null`
 * means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroCommunityStatsView(
  stats: HeroStats | null | undefined,
  heroId: string,
): HeroCommunityStatsView {
  if (stats === undefined) {
    return { kind: 'loading' };
  }

  if (stats === null) {
    return { kind: 'unavailable' };
  }

  const halfSeasonLabel = stats.halfSeason?.label ?? null;
  const fallbackFor = stats.inPlaceOf?.label ?? null;
  const line = stats.tiers.flatMap((tier) => tier.heroes).find((entry) => entry.hero === heroId);

  if (line !== undefined && !isReadable(line)) {
    return { kind: 'unavailable' };
  }

  if (line !== undefined) {
    return {
      kind: 'ready',
      halfSeasonLabel,
      fallbackFor,
      matchesCounted: stats.matchesCounted,
      appearances: line.appearances,
      figures: [
        { label: 'Win rate', value: percent(line.winRate) },
        { label: 'Pick rate', value: percent(line.pickRate) },
        { label: 'KDA', value: line.kda === null ? NOT_RECORDED : line.kda.toFixed(2) },
        {
          label: 'Final hits per match',
          value: line.finalHitsAverage === null ? NOT_RECORDED : line.finalHitsAverage.toFixed(1),
        },
      ],
    };
  }

  return {
    kind: 'not-enough-data',
    halfSeasonLabel,
    fallbackFor,
    appearances: stats.belowMinimum.find((entry) => entry.hero === heroId)?.appearances ?? 0,
    minimumMatches: stats.minimumMatches,
  };
}

/** A line whose headline numbers are not finite is treated as unreadable: "NaN%" is never printed. */
function isReadable(line: HeroStatsHero): boolean {
  return Number.isFinite(line.winRate) && Number.isFinite(line.pickRate) && Number.isFinite(line.appearances);
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}
