import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { buildHeroStatRow } from './hero-stat-row-view';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const stats: CommunityMatches = {
  status: 'ready',
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 1482,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthMinutes: null,
  perDay: null,
};
const noListing = { downloads: null, rating: null };

describe('buildHeroStatRow', () => {
  it('reads "Coming soon" for downloads and rating until the listing has them', () => {
    const [downloads, rating] = buildHeroStatRow(noListing, stats);

    expect(downloads).toEqual({ id: 'downloads', value: 'Coming soon', label: 'Downloads', pending: true });
    expect(rating).toEqual({ id: 'rating', value: 'Coming soon', label: 'Rating on Overwolf', pending: true });
  });

  it('never prints a zero download count or rating', () => {
    const row = buildHeroStatRow({ downloads: 0, rating: 0 }, stats);

    expect(row.slice(0, 2).every((stat) => stat.pending)).toBeTrue();
  });

  it('formats the listing figures once they are set', () => {
    const [downloads, rating] = buildHeroStatRow({ downloads: 12500, rating: 4.86 }, stats);

    expect(downloads.value).toBe('12,500');
    expect(rating.value).toBe('4.9 / 5');
    expect(rating.pending).toBeFalse();
  });

  it('states the matches counted and their half-season', () => {
    const matches = buildHeroStatRow(noListing, stats)[2];

    expect(matches).toEqual({ id: 'matches', value: '1,482', label: 'Matches counted · Season 10.5', pending: false });
  });

  it('names the previous half-season when it stands in for the current one', () => {
    const previous = { id: 10, label: 'Season 10', startsAt: null, endsAt: null };
    const matches = buildHeroStatRow(noListing, { ...stats, halfSeason: previous, inPlaceOf: season })[2];

    expect(matches.label).toBe('Matches counted · Season 10');
  });

  it('says "Match counted" for a single match', () => {
    expect(buildHeroStatRow(noListing, { ...stats, matchesCounted: 1 })[2].label).toBe(
      'Match counted · Season 10.5',
    );
  });

  it('leaves the matches figure out when the figures cannot be read or count nothing', () => {
    expect(buildHeroStatRow(noListing, null).map((stat) => stat.id)).toEqual(['downloads', 'rating']);
    expect(buildHeroStatRow(noListing, { ...stats, matchesCounted: 0 }).length).toBe(2);
    expect(buildHeroStatRow(noListing, { ...stats, matchesCounted: null }).length).toBe(2);
    expect(buildHeroStatRow(noListing, { ...stats, halfSeason: null }).length).toBe(2);
  });
});
