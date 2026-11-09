import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { communityTotalsPreview } from './community-totals-preview-view';

function answer(overrides: Partial<CommunityMatches>): CommunityMatches {
  return {
    status: 'ready',
    minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
    halfSeasons: [],
    halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
    inPlaceOf: null,
    matchesBand: 250,
    maps: [],
    mapsBelowMinimum: [],
    modeMix: null,
    averageLengthMinutes: 65,
    perDay: null,
    ...overrides,
  } as CommunityMatches;
}

describe('communityTotalsPreview', () => {
  it('shows the matches band, the average length and the season from the answer', () => {
    expect(communityTotalsPreview(answer({}))).toEqual([
      { label: 'Matches counted', value: '250+' },
      { label: 'Average match', value: '1 h 5 min' },
      { label: 'Season', value: 'Season 10.5' },
    ]);
  });

  it('labels the season as the previous half-season when it stands in for the current one', () => {
    const previous = { id: 10, label: 'Season 10', startsAt: null, endsAt: null };

    expect(
      communityTotalsPreview(
        answer({
          halfSeason: previous,
          inPlaceOf: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
        }),
      ),
    ).toEqual([
      { label: 'Matches counted', value: '250+' },
      { label: 'Average match', value: '1 h 5 min' },
      { label: 'Previous half-season', value: 'Season 10' },
    ]);
  });

  it('leaves out a figure the answer does not carry', () => {
    expect(communityTotalsPreview(answer({ matchesBand: null, averageLengthMinutes: null }))).toEqual([
      { label: 'Season', value: 'Season 10.5' },
    ]);
  });

  it('shows nothing while the answer is missing, failed or has not enough data', () => {
    expect(communityTotalsPreview(null)).toEqual([]);
    expect(communityTotalsPreview(answer({ status: 'not-enough-data', matchesBand: null }))).toEqual([]);
  });
});
