import type { HeroStatsHalfSeason, HeroStatsMode, HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { nonDefaultModeLabel } from '../../../shared/utilities/play-modes';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';

interface SeasonScoped {
  halfSeason: HeroStatsHalfSeason | null;
  inPlaceOf: HeroStatsHalfSeason | null;
  mode?: HeroStatsModeId | null;
  modes?: HeroStatsMode[];
}

/**
 * The sentence a section of the Team comps page shows when its own answer is for another half-season
 * than the rest of the page: one section can have enough data in the current half-season while another
 * is still short and shows the previous one. Null when the section shows the page's half-season.
 * `sectionName` is how the sentence refers to it, such as "Triple supports".
 */
export function sectionSeasonNotice(
  sectionName: string,
  answer: SeasonScoped,
  shownSeasonId: number | null,
): string | null {
  const season = answer.halfSeason;

  if (season === null || shownSeasonId === null || season.id === shownSeasonId) {
    return null;
  }

  return answer.inPlaceOf === null
    ? `${sectionName} are ${season.label}'s numbers.`
    : halfSeasonFallbackNotice(answer.inPlaceOf.label, season.label, nonDefaultModeLabel(answer));
}
