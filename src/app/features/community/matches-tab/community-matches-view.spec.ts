import type { CommunityMatches, CommunityModeShare } from '../../../../contracts/community-matches.model';
import { buildCommunityMatchesView, dayLabel, minutesLabel, type CommunityMatchesView } from './community-matches-view';

const SEASON_10_5 = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const SEASON_10 = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const QUICK_MATCH_ONLY: CommunityModeShare[] = [
  { playModeId: 0, mode: 'Quick Match', share: 100, averageLengthMinutes: null },
];

function matches(parts: Partial<CommunityMatches> = {}): CommunityMatches {
  return {
    status: 'ready',
    minimums: { overviewMatches: 20, mapMatches: 10, lengthMatches: 10, recorders: 3 },
    halfSeasons: [SEASON_10, SEASON_10_5],
    halfSeason: SEASON_10_5,
    inPlaceOf: null,
    matchesBand: 20,
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
    const view = buildCommunityMatchesView(matches({ status: 'not-enough-data', matchesBand: null }));

    expect(view.kind).toBe('not-enough-data');
    if (view.kind === 'not-enough-data') {
      expect(view.halfSeasonLabel).toBe('Season 10.5');
      expect(view.summary).toBe(
        'Season 10.5 does not have enough data yet. The first figures appear at 20 matches from at least 3 players.',
      );
    }
  });

  it('says so plainly before any half-season exists', () => {
    const view = buildCommunityMatchesView(
      matches({ status: 'not-enough-data', halfSeason: null, halfSeasons: [], matchesBand: null }),
    );

    expect(view.kind === 'not-enough-data' && view.summary).toBe(
      'No matches are counted yet. The first figures appear at 20 matches from at least 3 players.',
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

  it('has no notice for the current half-season, and states the volume as a band', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY, matchesBand: 100 })));

    expect(view.notice).toBeNull();
    expect(view.sample).toBe('100+ matches in Season 10.5, each counted once however many players recorded it.');
  });

  it('states no volume when the sample is below the smallest band', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY, matchesBand: null })));

    expect(view.sample).toBe('Matches in Season 10.5, each counted once however many players recorded it.');
  });

  it('shows each map with its whole-percentage rate and a bar, and names the thin ones without a count', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({ maps: [{ map: 'Tokyo 2099', winRate: 58 }], mapsBelowMinimum: ['Klyntar', 'Hydra Base'] }),
      ),
    );

    expect(view.maps.rows).toEqual([{ map: 'Tokyo 2099', winRateLabel: '58%', barPercent: 58 }]);
    expect(view.maps.pending).toEqual(['Klyntar', 'Hydra Base']);
    expect(view.maps.note).toBeNull();
  });

  it('shows the not-enough-data note for maps when none has a rate yet', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY })));

    expect(view.maps.rows).toEqual([]);
    expect(view.maps.pending).toEqual([]);
    expect(view.maps.note).toBe(
      'Not enough data yet. A map needs 10 matches with a result from at least 3 players before its win rate shows.',
    );
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
    expect(view.modeMix.note).toBe('Not enough data yet. The mix appears at 20 matches from at least 3 players.');
    expect(view.averageLength.label).toBeNull();
    expect(view.averageLength.note).toBe(
      'Not enough data yet. An average needs 10 matches with a known length from at least 3 players.',
    );
    expect(view.perDay.rows).toEqual([]);
    expect(view.perDay.note).toBe('Not enough data yet. Days appear at 20 matches from at least 3 players.');
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

describe('dayLabel', () => {
  it('names the weekday and date of a UTC day', () => {
    expect(dayLabel('2026-10-29')).toBe('Thu 29 Oct');
    expect(dayLabel('2026-01-01')).toBe('Thu 1 Jan');
  });

  it('falls back to the raw value for a day it cannot read', () => {
    expect(dayLabel('later')).toBe('later');
  });
});
