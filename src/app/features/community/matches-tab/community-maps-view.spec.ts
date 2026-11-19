import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { buildCommunityMapsPageView, buildMapsView } from './community-maps-view';

const SEASON_10_5 = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const SEASON_10 = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const MAPS = [
  { map: 'A', winRate: 70 },
  { map: 'B', winRate: 65 },
  { map: 'C', winRate: 60 },
  { map: 'D', winRate: 55 },
  { map: 'E', winRate: 50 },
  { map: 'F', winRate: 45 },
  { map: 'G', winRate: 40 },
];

function matches(parts: Partial<CommunityMatches> = {}): CommunityMatches {
  return {
    status: 'ready',
    minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
    halfSeasons: [SEASON_10, SEASON_10_5],
    halfSeason: SEASON_10_5,
    inPlaceOf: null,
    matchesCounted: 20,
    maps: MAPS,
    mapsBelowMinimum: [],
    modeMix: null,
    averageLengthMinutes: null,
    perDay: null,
    ...parts,
  };
}

describe('buildMapsView', () => {
  it('ranks every map best first whatever order the answer lists them in, with the best and worst three of them', () => {
    const view = buildMapsView(matches({ maps: [...MAPS].reverse() }));

    expect(view.all.map((row) => row.map)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(view.best.map((row) => row.map)).toEqual(['A', 'B', 'C']);
    expect(view.worst.map((row) => row.map)).toEqual(['G', 'F', 'E']);
    expect(view.all[0]).toEqual({ map: 'A', winRateLabel: '70%', barPercent: 70 });
    expect(view.allLabel).toBe('All 7 maps');
    expect(view.note).toBeNull();
  });

  it('never lists a map in both the best and the worst', () => {
    const view = buildMapsView(matches({ maps: MAPS.slice(0, 5) }));

    expect(view.best.map((row) => row.map)).toEqual(['A', 'B', 'C']);
    expect(view.worst.map((row) => row.map)).toEqual(['E', 'D']);
  });

  it('names the maps still waiting for a rate as one line of names, with no count', () => {
    expect(buildMapsView(matches({ mapsBelowMinimum: ['Klyntar', 'Hydra Base'] })).waitingNote).toBe('Klyntar, Hydra Base.');
    expect(buildMapsView(matches()).waitingNote).toBeNull();
  });

  it('says what a map needs, and offers no link, while no map has a rate', () => {
    const view = buildMapsView(matches({ maps: [] }));

    expect(view.all).toEqual([]);
    expect(view.allLabel).toBeNull();
    expect(view.note).toBe(
      'Not enough data yet. A map needs 10 matches in one game mode and 10 with a result before its win rate shows.',
    );
  });
});

describe('buildCommunityMapsPageView', () => {
  it('is loading until the answer arrives and unavailable when it could not be read', () => {
    expect(buildCommunityMapsPageView(undefined).kind).toBe('loading');
    expect(buildCommunityMapsPageView(null).kind).toBe('unavailable');
  });

  it('is not enough data, which keeps the page thin, until one map has a rate', () => {
    const view = buildCommunityMapsPageView(matches({ maps: [], mapsBelowMinimum: ['Klyntar'] }));

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('Season 10.5 has no map with a win rate yet.');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('A map needs 10 matches');
  });

  it('is ready as soon as one map has a rate', () => {
    const view = buildCommunityMapsPageView(matches({ maps: [{ map: 'A', winRate: 52 }] }));

    expect(view.kind).toBe('ready');
    expect(view.kind === 'ready' && view.maps.all.length).toBe(1);
  });

  it('goes by the maps alone: ready with a map whatever else the answer holds, not ready without one', () => {
    expect(buildCommunityMapsPageView(matches({ status: 'not-enough-data', maps: MAPS })).kind).toBe('ready');
    expect(buildCommunityMapsPageView(matches({ status: 'ready', maps: [], modeMix: [] })).kind).toBe('not-enough-data');
  });

  it('says which half-season stands in for the current one', () => {
    const view = buildCommunityMapsPageView(matches({ halfSeason: SEASON_10, inPlaceOf: SEASON_10_5 }));

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.notice).toBe(
      "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
    );
  });

  it('has no notice when the current half-season is the one shown', () => {
    const view = buildCommunityMapsPageView(matches());

    expect(view.kind === 'ready' && view.notice).toBeNull();
  });
});
