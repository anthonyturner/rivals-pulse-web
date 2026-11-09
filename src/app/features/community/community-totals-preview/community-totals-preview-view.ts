import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { minutesLabel } from '../matches-tab/community-matches-view';

export interface TotalsFigure {
  label: string;
  value: string;
}

/**
 * The figures the lead tile shows, each only if the answer really carries it. The matches band is
 * the answer's own rounded count (such as "250+"), never an exact number. The season figure is labelled
 * "Previous half-season" when the answer is the previous half-season standing in for the current one.
 */
export function communityTotalsPreview(data: CommunityMatches | null): TotalsFigure[] {
  if (data === null || data.status !== 'ready') {
    return [];
  }

  const figures: TotalsFigure[] = [];

  if (data.matchesBand !== null) {
    figures.push({ label: 'Matches counted', value: `${data.matchesBand}+` });
  }

  if (data.averageLengthMinutes !== null) {
    figures.push({ label: 'Average match', value: minutesLabel(data.averageLengthMinutes) });
  }

  if (data.halfSeason !== null) {
    // When the previous half-season stands in, the figure says so: a bare "Season" would read as current.
    figures.push({
      label: data.inPlaceOf === null ? 'Season' : 'Previous half-season',
      value: data.halfSeason.label,
    });
  }

  return figures;
}
