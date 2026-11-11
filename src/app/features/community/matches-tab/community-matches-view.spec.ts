import type { CommunityMatches, CommunityModeShare } from '../../../../contracts/community-matches.model';
import { buildCommunityMatchesView, minutesLabel, recentMatchesPerDay, type CommunityMatchesView } from './community-matches-view';

const SEASON_10_5 = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const SEASON_10 = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const QUICK_MATCH_ONLY: CommunityModeShare[] = [
  { playModeId: 0, mode: 'Quick Match', share: 100, averageLengthMinutes: null },
];

function matches(parts: Partial<CommunityMatches> = {}): CommunityMatches {
  return {
    status: 'ready',
    minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
    halfSeasons: [SEASON_10, SEASON_10_5],
    halfSeason: SEASON_10_5,
    inPlaceOf: null,
    matchesCounted: 20,
    maps: [],
    mapsBelowMinimum: [],
    modeMix: null,
    averageLengthMinutes: null,
    perDay: null,
    ...parts,
  };
}

function ready(view: CommunityMatchesView) {
  if (view.kind !== 'ready') {
    throw new Error(`expected a ready view, got ${view.kind}`);
  }

  return view;
}

describe('buildCommunityMatchesView', () => {
  it('is loading until the answer arrives and unavailable when it could not be read', () => {
    expect(buildCommunityMatchesView(undefined).kind).toBe('loading');
    expect(buildCommunityMatchesView(null).kind).toBe('unavailable');
  });

  it('is the designed empty state, with what it waits for and no count, when nothing is ready', () => {
    const view = buildCommunityMatchesView(matches({ status: 'not-enough-data', matchesCounted: null }));

    expect(view.kind).toBe('not-enough-data');
    if (view.kind === 'not-enough-data') {
      expect(view.halfSeasonLabel).toBe('Season 10.5');
      expect(view.summary).toBe(
        "Season 10.5 does not have enough data yet. Totals appear once enough matches have been uploaded.",
      );
    }
  });

  it('says so plainly before any half-season exists', () => {
    const view = buildCommunityMatchesView(
      matches({ status: 'not-enough-data', halfSeason: null, halfSeasons: [], matchesCounted: null }),
    );

    expect(view.kind === 'not-enough-data' && view.summary).toBe(
      "No matches are counted yet. Totals appear once enough matches have been uploaded.",
    );
  });

  it('labels the previous half-season that stands in for the current one', () => {
    const view = ready(
      buildCommunityMatchesView(matches({ halfSeason: SEASON_10, inPlaceOf: SEASON_10_5, modeMix: QUICK_MATCH_ONLY })),
    );

    expect(view.halfSeasonLabel).toBe('Season 10');
    expect(view.notice).toBe(
      "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
    );
  });

  it('has no notice for the current half-season, and states the matches counted', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY, matchesCounted: 484 })));

    expect(view.notice).toBeNull();
    expect(view.sample).toBe('484 matches in Season 10.5');
  });

  it('states no volume when the matches counted are not known', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY, matchesCounted: null })));

    expect(view.sample).toBe('Matches in Season 10.5');
  });

  it('splits a short list of maps between best and worst, and names the waiting ones without a count', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({ maps: [{ map: 'Tokyo 2099', winRate: 58 }], mapsBelowMinimum: ['Klyntar', 'Hydra Base'] }),
      ),
    );

    expect(view.maps.best).toEqual([{ map: 'Tokyo 2099', winRateLabel: '58%', barPercent: 58 }]);
    expect(view.maps.all).toEqual(view.maps.best);
    expect(view.maps.worst).toEqual([]);
    expect(view.maps.waitingNote).toBe('Klyntar, Hydra Base.');
    expect(view.maps.allLabel).toBe('All 1 map');
    expect(view.maps.note).toBeNull();
  });

  it('shows the not-enough-data note for maps when none has a rate yet', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY })));

    expect(view.maps.best).toEqual([]);
    expect(view.maps.worst).toEqual([]);
    expect(view.maps.waitingNote).toBeNull();
    expect(view.maps.allLabel).toBeNull();
    expect(view.maps.note).toBe(
      'Not enough data yet. A map needs 10 matches in one game mode and 10 with a result before its win rate shows.',
    );
  });

  const MAPS = [
    { map: 'A', winRate: 70 },
    { map: 'B', winRate: 65 },
    { map: 'C', winRate: 60 },
    { map: 'D', winRate: 55 },
    { map: 'E', winRate: 50 },
    { map: 'F', winRate: 45 },
    { map: 'G', winRate: 40 },
  ];

  it('picks the best three and the worst three maps, worst first, whatever order the answer lists them in', () => {
    const view = ready(buildCommunityMatchesView(matches({ maps: [...MAPS].reverse() })));

    expect(view.maps.best.map((row) => row.map)).toEqual(['A', 'B', 'C']);
    expect(view.maps.worst.map((row) => row.map)).toEqual(['G', 'F', 'E']);
    expect(view.maps.all.map((row) => row.map)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('never lists a map in both the best and the worst', () => {
    const view = ready(buildCommunityMatchesView(matches({ maps: MAPS.slice(0, 5) })));

    expect(view.maps.best.map((row) => row.map)).toEqual(['A', 'B', 'C']);
    expect(view.maps.worst.map((row) => row.map)).toEqual(['E', 'D']);
  });

  it('shows the mode mix with shares and per-mode lengths in minutes', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({
          modeMix: [
            { playModeId: 0, mode: 'Quick Match', share: 75, averageLengthMinutes: 10 },
            { playModeId: 1, mode: 'Competitive', share: 25, averageLengthMinutes: null },
          ],
        }),
      ),
    );

    expect(view.modeMix.rows).toEqual([
      { mode: 'Quick Match', shareLabel: '75%', lengthLabel: '10 min', barPercent: 75 },
      { mode: 'Competitive', shareLabel: '25%', lengthLabel: null, barPercent: 25 },
    ]);
    expect(view.modeMix.note).toBeNull();
  });

  it('has a note, not a blank panel, for every section without figures', () => {
    const view = ready(buildCommunityMatchesView(matches({ maps: [{ map: 'Tokyo 2099', winRate: 50 }] })));

    expect(view.modeMix.rows).toEqual([]);
    expect(view.modeMix.note).toBe('Not enough data yet. The mix appears at 10 matches.');
    expect(view.averageLength.label).toBeNull();
    expect(view.averageLength.note).toBe(
      'Not enough data yet. An average needs 10 matches with a known length.',
    );
    expect(view.perDay.rows).toEqual([]);
    expect(view.perDay.note).toBe('Not enough data yet. A day is listed once it has 10 matches.');
  });

  it('gives a note when the answer lists a mode mix or days but they are empty', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: [], perDay: [] })));

    expect(view.modeMix.note).toBe('Not enough data yet. The mix appears at 10 matches.');
    expect(view.perDay.note).toBe('Not enough data yet. A day is listed once it has 10 matches.');
  });

  it('reads the recent pace from the full days before the latest, which is still filling', () => {
    const perDay = [10, 20, 20, 20, 2].map((share, index) => ({ day: '2026-10-2' + index, share }));
    expect(recentMatchesPerDay(matches({ matchesCounted: 500, perDay }))).toBeCloseTo(500 * (20 / 100), 5);
  });

  it('has no recent pace without a listed day or a count of matches', () => {
    expect(recentMatchesPerDay(matches({ perDay: null }))).toBeNull();
    expect(recentMatchesPerDay(matches({ matchesCounted: null, perDay: [{ day: '2026-10-29', share: 50 }] }))).toBeNull();
  });

  it('shows the average length and the days as shares, with bars scaled to the busiest day', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({
          averageLengthMinutes: 12,
          perDay: [
            { day: '2026-10-28', share: 20 },
            { day: '2026-10-29', share: 80 },
          ],
        }),
      ),
    );

    expect(view.averageLength).toEqual({ label: '12 min', note: null });
    expect(view.perDay.rows).toEqual([
      { day: 'Wed 28 Oct', shareLabel: '20%', barPercent: 25 },
      { day: 'Thu 29 Oct', shareLabel: '80%', barPercent: 100 },
    ]);
    expect(view.perDay.note).toBeNull();
  });
});

describe('minutesLabel', () => {
  it('writes whole minutes, and hours past the hour', () => {
    expect(minutesLabel(12)).toBe('12 min');
    expect(minutesLabel(1)).toBe('1 min');
    expect(minutesLabel(60)).toBe('1 h');
    expect(minutesLabel(65)).toBe('1 h 5 min');
  });
});
