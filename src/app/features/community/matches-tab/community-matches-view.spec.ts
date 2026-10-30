import type { CommunityMatches, CommunityModeShare } from '../../../../contracts/community-matches.model';
import {
  buildCommunityMatchesView,
  dayLabel,
  durationLabel,
  type CommunityMatchesView,
} from './community-matches-view';

const SEASON_10_5 = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const SEASON_10 = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const QUICK_MATCH_ONLY: CommunityModeShare[] = [
  { playModeId: 0, mode: 'Quick Match', matches: 40, share: 100, averageLengthSeconds: null },
];

function matches(parts: Partial<CommunityMatches> = {}): CommunityMatches {
  return {
    status: 'ready',
    minimums: { overviewMatches: 20, mapMatches: 10, lengthMatches: 10 },
    halfSeasons: [SEASON_10, SEASON_10_5],
    halfSeason: SEASON_10_5,
    inPlaceOf: null,
    matchesCounted: 40,
    maps: [],
    mapsBelowMinimum: [],
    modeMix: null,
    averageLengthSeconds: null,
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

  it('is the designed empty state, with the sample it waits for, when nothing is ready', () => {
    const view = buildCommunityMatchesView(matches({ status: 'not-enough-data', matchesCounted: 4 }));

    expect(view.kind).toBe('not-enough-data');
    if (view.kind === 'not-enough-data') {
      expect(view.halfSeasonLabel).toBe('Season 10.5');
      expect(view.summary).toBe('Season 10.5 has 4 matches counted so far. The first figures appear at 20 matches.');
    }
  });

  it('names no zero when nothing is counted in the half-season yet', () => {
    const view = buildCommunityMatchesView(matches({ status: 'not-enough-data', matchesCounted: 0 }));

    expect(view.kind === 'not-enough-data' && view.summary).toBe(
      'No matches are counted in Season 10.5 yet. The first figures appear at 20 matches.',
    );
  });

  it('says so plainly before any half-season exists', () => {
    const view = buildCommunityMatchesView(
      matches({ status: 'not-enough-data', halfSeason: null, halfSeasons: [], matchesCounted: 0 }),
    );

    expect(view.kind === 'not-enough-data' && view.summary).toBe(
      'No matches are counted yet. The first figures appear at 20 matches.',
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

  it('has no notice for the current half-season', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY })));

    expect(view.notice).toBeNull();
    expect(view.sample).toBe('40 matches counted in Season 10.5, each once however many players recorded it.');
  });

  it('shows each map with its rate, its record and a bar, and lists the thin ones', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({
          maps: [{ map: 'Tokyo 2099', matches: 12, wins: 7, winRate: (7 / 12) * 100 }],
          mapsBelowMinimum: [
            { map: 'Klyntar', matches: 4 },
            { map: 'Hydra Base', matches: 1 },
          ],
        }),
      ),
    );

    expect(view.maps.rows).toEqual([
      { map: 'Tokyo 2099', winRateLabel: '58.3%', recordLabel: '7 wins in 12 matches', barPercent: (7 / 12) * 100 },
    ]);
    expect(view.maps.pending).toEqual(['Klyntar: 4 of 10 matches', 'Hydra Base: 1 of 10 matches']);
    expect(view.maps.note).toBeNull();
  });

  it('shows the not-enough-data note for maps when none has a rate yet', () => {
    const view = ready(buildCommunityMatchesView(matches({ modeMix: QUICK_MATCH_ONLY })));

    expect(view.maps.rows).toEqual([]);
    expect(view.maps.pending).toEqual([]);
    expect(view.maps.note).toBe('Not enough data yet. A map needs 10 matches with a result before its win rate shows.');
  });

  it('shows the mode mix with shares and per-mode lengths', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({
          modeMix: [
            { playModeId: 0, mode: 'Quick Match', matches: 30, share: 75, averageLengthSeconds: 615 },
            { playModeId: 1, mode: 'Competitive', matches: 10, share: 25, averageLengthSeconds: null },
          ],
        }),
      ),
    );

    expect(view.modeMix.rows).toEqual([
      { mode: 'Quick Match', shareLabel: '75.0%', matchesLabel: '30 matches', lengthLabel: '10 min 15 s', barPercent: 75 },
      { mode: 'Competitive', shareLabel: '25.0%', matchesLabel: '10 matches', lengthLabel: null, barPercent: 25 },
    ]);
    expect(view.modeMix.note).toBeNull();
  });

  it('has a note, not a blank panel, for every section without figures', () => {
    const view = ready(
      buildCommunityMatchesView(matches({ maps: [{ map: 'Tokyo 2099', matches: 12, wins: 6, winRate: 50 }] })),
    );

    expect(view.modeMix.rows).toEqual([]);
    expect(view.modeMix.note).toBe('Not enough data yet. The mix appears at 20 matches.');
    expect(view.averageLength.label).toBeNull();
    expect(view.averageLength.note).toBe('Not enough data yet. An average needs 10 matches with a known length.');
    expect(view.perDay.rows).toEqual([]);
    expect(view.perDay.note).toBe('Not enough data yet. Days appear at 20 matches.');
  });

  it('shows the average length and the days with bars scaled to the busiest day', () => {
    const view = ready(
      buildCommunityMatchesView(
        matches({
          averageLengthSeconds: 725,
          perDay: [
            { day: '2026-10-28', matches: 5 },
            { day: '2026-10-29', matches: 20 },
          ],
        }),
      ),
    );

    expect(view.averageLength).toEqual({ label: '12 min 5 s', note: null });
    expect(view.perDay.rows).toEqual([
      { day: 'Wed 28 Oct', matchesLabel: '5 matches', barPercent: 25 },
      { day: 'Thu 29 Oct', matchesLabel: '20 matches', barPercent: 100 },
    ]);
    expect(view.perDay.note).toBeNull();
  });
});

describe('durationLabel', () => {
  it('writes minutes and seconds, rounded to the second', () => {
    expect(durationLabel(615)).toBe('10 min 15 s');
    expect(durationLabel(600.4)).toBe('10 min');
    expect(durationLabel(45)).toBe('45 s');
    expect(durationLabel(3725)).toBe('1 h 2 min');
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
