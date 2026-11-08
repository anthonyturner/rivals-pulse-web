import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel, placementRequirementLabel } from '../../../shared/utilities/stat-labels';

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
      /** The shared fallback sentence, set when this is the previous half-season. */
      notice: string | null;
      /** The sample behind the figures, such as "From 24 appearances in 150 matches ...". */
      sample: string;
      figures: HeroCommunityFigure[];
    }
  | {
      kind: 'not-enough-data';
      halfSeasonLabel: string | null;
      fallbackFor: string | null;
      /** Says how many appearances the hero has so far, which is none when no recorded match has it. */
      summary: string;
      figures: HeroCommunityFigure[];
    };

const NOT_RECORDED = 'Not recorded';

/**
 * What a hero page shows for one hero. `undefined` means the stats have not answered yet and `null`
 * means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroCommunityStatsView(
  stats: HeroStats | null | undefined,
  heroId: string,
  heroName: string,
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
      notice:
        stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, halfSeasonLabel),
      sample: `From ${countLabel(line.appearances, 'appearance', 'appearances')} in ${countLabel(stats.matchesCounted, 'match', 'matches')} recorded by RivalsPulse players. Pick rate is a share of those matches, so a hero on both teams of one match counts twice.`,
      figures: [
        { label: 'Win rate', value: percentLabel(line.winRate) },
        { label: 'Pick rate', value: percentLabel(line.pickRate) },
        { label: 'Ban rate', value: 'Not collected' },
        { label: 'KDA', value: line.kda === null ? NOT_RECORDED : line.kda.toFixed(2) },
        {
          label: 'Final hits per match',
          value: line.finalHitsAverage === null ? NOT_RECORDED : line.finalHitsAverage.toFixed(1),
        },
      ],
    };
  }

  const held = stats.belowMinimum.find((entry) => entry.hero === heroId);
  const appearances = held?.appearances ?? 0;
  const soFar =
    held?.players === undefined
      ? countLabel(appearances, 'appearance', 'appearances')
      : `${countLabel(appearances, 'appearance', 'appearances')} and ${countLabel(held.players, 'player', 'players')}`;
  const needed = `The numbers appear at ${placementRequirementLabel(stats)}.`;
  const where = fallbackFor === null || halfSeasonLabel === null ? '' : ` in ${halfSeasonLabel}`;

  return {
    kind: 'not-enough-data',
    halfSeasonLabel,
    fallbackFor,
    figures: [
      { label: 'Win rate', value: 'Building sample' },
      { label: 'Pick rate', value: 'Building sample' },
      { label: 'Ban rate', value: 'Not collected' },
    ],
    summary:
      appearances > 0
        ? `${heroName} has ${soFar} so far${where}, from matches recorded by RivalsPulse players. ${needed}`
        : `No match recorded by RivalsPulse players has ${heroName} yet${where}. ${needed}`,
  };
}

/** A line whose headline numbers are not finite is treated as unreadable: "NaN%" is never printed. */
function isReadable(line: HeroStatsHero): boolean {
  return Number.isFinite(line.winRate) && Number.isFinite(line.pickRate) && Number.isFinite(line.appearances);
}
