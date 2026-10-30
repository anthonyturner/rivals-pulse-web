import {
  COMMUNITY_MATCHES_MINIMUMS,
  MATCH_VOLUME_BANDS,
  deriveCommunityMatches,
  matchVolumeBand,
  playModeName,
  type CommunityDayRow,
  type CommunityMapRow,
  type CommunityMatchesSource,
  type CommunityModeRow,
} from './community-matches';
import { PLAY_MODE_IDS } from './hero-stats';

const NOW = new Date('2026-10-30T12:00:00Z');
const { overviewMatches, mapMatches, lengthMatches } = COMMUNITY_MATCHES_MINIMUMS;

const HALF_SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];

function modeRow(playModeId: number, matches: number, extra: Partial<CommunityModeRow> = {}): CommunityModeRow {
  return { halfSeason: 10.5, playModeId, matches, durationSumSeconds: 0, durationN: 0, ...extra };
}

function mapRow(
  mapName: string,
  playModeId: number,
  decidedMatches: number,
  wins: number,
  extra: Partial<CommunityMapRow> = {},
): CommunityMapRow {
  return { halfSeason: 10.5, playModeId, mapName, matches: decidedMatches, decidedMatches, wins, ...extra };
}

function dayRow(day: string, matches: number, halfSeason = 10.5): CommunityDayRow {
  return { halfSeason, day, matches };
}

function source(parts: Partial<CommunityMatchesSource> = {}): CommunityMatchesSource {
  return { halfSeasons: HALF_SEASONS, modes: [], maps: [], days: [], ...parts };
}

describe('deriveCommunityMatches', () => {
  it('is the designed empty state when nothing has been counted', () => {
    const result = deriveCommunityMatches(source({ halfSeasons: [] }), { now: NOW });

    expect(result.status).toBe('not-enough-data');
    expect(result.halfSeason).toBeNull();
    expect(result.halfSeasons).toEqual([]);
    expect(result.matchesBand).toBeNull();
    expect(result.maps).toEqual([]);
    expect(result.modeMix).toBeNull();
    expect(result.averageLengthMinutes).toBeNull();
    expect(result.perDay).toBeNull();
  });

  it('is empty, not broken, for a current half-season with no counts yet', () => {
    const result = deriveCommunityMatches(source(), { now: NOW });

    expect(result.status).toBe('not-enough-data');
    expect(result.halfSeason).toEqual({
      id: 10.5,
      label: 'Season 10.5',
      startsAt: '2026-10-09T09:00:00Z',
      endsAt: null,
    });
    expect(result.halfSeasons.map((season) => season.id)).toEqual([10, 10.5]);
  });

  describe('mode mix and average length', () => {
    it('shares the matches whose mode is known and averages only the matches with a length', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [
            modeRow(PLAY_MODE_IDS.quickMatch, 30, { durationSumSeconds: 9000, durationN: 15 }),
            modeRow(PLAY_MODE_IDS.competitive, 10, { durationSumSeconds: 6000, durationN: 10 }),
          ],
        }),
        { now: NOW },
      );

      expect(result.status).toBe('ready');
      expect(result.modeMix).toEqual([
        { playModeId: 0, mode: 'Quick Match', share: 75, averageLengthMinutes: 10 },
        { playModeId: 1, mode: 'Competitive', share: 25, averageLengthMinutes: 10 },
      ]);
      // 15000 seconds over 25 matches with a length, not over all 40.
      expect(result.averageLengthMinutes).toBe(10);
    });

    it('rounds an average to the minute', () => {
      const result = deriveCommunityMatches(
        source({ modes: [modeRow(PLAY_MODE_IDS.quickMatch, 100, { durationSumSeconds: 7250, durationN: lengthMatches })] }),
        { now: NOW },
      );

      // 725 seconds is 12 minutes 5 seconds.
      expect(result.averageLengthMinutes).toBe(12);
    });

    it('leaves an average out below its minimum, per mode and overall', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [
            modeRow(PLAY_MODE_IDS.quickMatch, 30, { durationSumSeconds: 600, durationN: 4 }),
            modeRow(PLAY_MODE_IDS.competitive, 10, { durationSumSeconds: 1200, durationN: 2 }),
          ],
        }),
        { now: NOW },
      );

      expect(result.modeMix?.map((share) => share.averageLengthMinutes)).toEqual([null, null]);
      expect(result.averageLengthMinutes).toBeNull();
    });

    it('averages all modes together once the overall sample is large enough', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [
            modeRow(PLAY_MODE_IDS.quickMatch, 30, { durationSumSeconds: 3000, durationN: 6 }),
            modeRow(PLAY_MODE_IDS.competitive, 10, { durationSumSeconds: 2000, durationN: 4 }),
          ],
        }),
        { now: NOW },
      );

      expect(result.modeMix?.map((share) => share.averageLengthMinutes)).toEqual([null, null]);
      // 5000 seconds over 10 matches is 500 seconds, 8 minutes 20 seconds.
      expect(result.averageLengthMinutes).toBe(8);
    });

    it('keeps matches with no reported mode out of the mix but counts them everywhere else', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [
            modeRow(PLAY_MODE_IDS.quickMatch, 20),
            modeRow(PLAY_MODE_IDS.unknown, 20, { durationSumSeconds: 12000, durationN: 20 }),
          ],
        }),
        { now: NOW },
      );

      expect(result.matchesBand).toBe(20);
      expect(result.modeMix).toEqual([{ playModeId: 0, mode: 'Quick Match', share: 100, averageLengthMinutes: null }]);
      expect(result.averageLengthMinutes).toBe(10);
    });

    it('shows no mix below the sample a half-season needs', () => {
      const result = deriveCommunityMatches(
        source({ modes: [modeRow(PLAY_MODE_IDS.quickMatch, overviewMatches - 1)] }),
        { now: NOW },
      );

      expect(result.modeMix).toBeNull();
      expect(result.status).toBe('not-enough-data');
    });

    it('orders the mix by share, then mode id', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [
            modeRow(PLAY_MODE_IDS.practice, 5),
            modeRow(PLAY_MODE_IDS.arcade, 10),
            modeRow(PLAY_MODE_IDS.competitive, 10),
            modeRow(PLAY_MODE_IDS.quickMatch, 15),
          ],
        }),
        { now: NOW },
      );

      expect(result.modeMix?.map((share) => share.playModeId)).toEqual([0, 1, 2, 3]);
    });

    it('never shows a mode that happened as 0 percent', () => {
      const result = deriveCommunityMatches(
        source({ modes: [modeRow(PLAY_MODE_IDS.quickMatch, 999), modeRow(PLAY_MODE_IDS.practice, 1)] }),
        { now: NOW },
      );

      expect(result.modeMix?.map((share) => share.share)).toEqual([100, 1]);
    });
  });

  describe('win rate by map', () => {
    it('blends Competitive and Quick Match and leaves the other modes out', () => {
      const result = deriveCommunityMatches(
        source({
          maps: [
            mapRow('Tokyo 2099', PLAY_MODE_IDS.quickMatch, 8, 4),
            mapRow('Tokyo 2099', PLAY_MODE_IDS.competitive, 4, 3),
            mapRow('Tokyo 2099', PLAY_MODE_IDS.arcade, 50, 0),
            mapRow('Tokyo 2099', PLAY_MODE_IDS.unknown, 50, 0),
          ],
        }),
        { now: NOW },
      );

      // 7 wins in 12 is 58.3%, shown as a whole percentage.
      expect(result.maps).toEqual([{ map: 'Tokyo 2099', winRate: 58 }]);
    });

    it('names a map under the minimum without a rate or a count, and never one with no result', () => {
      const result = deriveCommunityMatches(
        source({
          maps: [
            mapRow('Klyntar', PLAY_MODE_IDS.quickMatch, mapMatches - 1, 9),
            mapRow('Hellfire Gala', PLAY_MODE_IDS.quickMatch, 0, 0, { matches: 12 }),
            mapRow('Birnin T’Challa', PLAY_MODE_IDS.quickMatch, mapMatches, 5),
          ],
        }),
        { now: NOW },
      );

      expect(result.maps.map((record) => record.map)).toEqual(['Birnin T’Challa']);
      expect(result.mapsBelowMinimum).toEqual(['Klyntar']);
      expect(result.status).toBe('ready');
    });

    it('orders maps by win rate, then name, never by how many matches they have', () => {
      const result = deriveCommunityMatches(
        source({
          maps: [
            mapRow('Yggsgard', PLAY_MODE_IDS.quickMatch, 12, 6),
            mapRow('Central Park', PLAY_MODE_IDS.quickMatch, 200, 100),
            mapRow('Hydra Base', PLAY_MODE_IDS.quickMatch, 12, 9),
          ],
        }),
        { now: NOW },
      );

      expect(result.maps.map((record) => record.map)).toEqual(['Hydra Base', 'Central Park', 'Yggsgard']);
    });

    it('has no win rate that is NaN or infinite because a count is zero', () => {
      const result = deriveCommunityMatches(
        source({ maps: [mapRow('Empire of Eternal Night', PLAY_MODE_IDS.quickMatch, 0, 0)] }),
        { now: NOW },
      );

      expect(result.maps).toEqual([]);
      expect(result.mapsBelowMinimum).toEqual([]);
      expect(result.status).toBe('not-enough-data');
    });
  });

  describe('matches per day', () => {
    it('lists the days in order, as shares of the days shown, once there are enough matches', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 25)],
          days: [dayRow('2026-10-12', 5), dayRow('2026-10-10', 20), dayRow('2026-09-20', 7, 10)],
        }),
        { now: NOW },
      );

      expect(result.perDay).toEqual([
        { day: '2026-10-10', share: 80 },
        { day: '2026-10-12', share: 20 },
      ]);
    });

    it('sizes the sample by the days the database let through, not by the mode totals', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 60)],
          days: [dayRow('2026-10-10', overviewMatches - 1)],
        }),
        { now: NOW },
      );

      expect(result.modeMix).not.toBeNull();
      expect(result.perDay).toBeNull();
    });

    it('shows no days below the sample a half-season needs', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 3)],
          days: [dayRow('2026-10-12', 3)],
        }),
        { now: NOW },
      );

      expect(result.perDay).toBeNull();
    });
  });

  describe('which half-season', () => {
    const previous = {
      modes: [modeRow(PLAY_MODE_IDS.quickMatch, 60, { halfSeason: 10 })],
      maps: [mapRow('Tokyo 2099', PLAY_MODE_IDS.quickMatch, 30, 15, { halfSeason: 10 })],
    };

    it('shows the previous half-season, labelled, while the current one is below the minimum', () => {
      const result = deriveCommunityMatches(
        source({ ...previous, modes: [...previous.modes, modeRow(PLAY_MODE_IDS.quickMatch, 4)] }),
        { now: NOW },
      );

      expect(result.halfSeason?.id).toBe(10);
      expect(result.inPlaceOf?.id).toBe(10.5);
      expect(result.matchesBand).toBe(50);
      expect(result.maps.map((record) => record.map)).toEqual(['Tokyo 2099']);
    });

    it('shows the current half-season once it has enough, with nothing standing in', () => {
      const result = deriveCommunityMatches(
        source({ ...previous, modes: [...previous.modes, modeRow(PLAY_MODE_IDS.quickMatch, overviewMatches)] }),
        { now: NOW },
      );

      expect(result.halfSeason?.id).toBe(10.5);
      expect(result.inPlaceOf).toBeNull();
      expect(result.matchesBand).toBe(20);
    });

    it('stays on the current half-season when the previous one is no better', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 4, { halfSeason: 10 }), modeRow(PLAY_MODE_IDS.quickMatch, 6)],
        }),
        { now: NOW },
      );

      expect(result.halfSeason?.id).toBe(10.5);
      expect(result.inPlaceOf).toBeNull();
      expect(result.status).toBe('not-enough-data');
    });

    it('answers for exactly the half-season asked for, with no fall back', () => {
      const result = deriveCommunityMatches(source(previous), { now: NOW, halfSeason: 10.5 });

      expect(result.halfSeason?.id).toBe(10.5);
      expect(result.inPlaceOf).toBeNull();
      expect(result.status).toBe('not-enough-data');
    });

    it('gives the empty state for a half-season that has not started or is not a number', () => {
      for (const asked of [11, Number.NaN]) {
        const result = deriveCommunityMatches(source(previous), { now: NOW, halfSeason: asked });

        expect(result.halfSeason).toBeNull();
        expect(result.status).toBe('not-enough-data');
        expect(result.matchesBand).toBeNull();
      }
    });

    it('does not mix one half-season into another', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 30), modeRow(PLAY_MODE_IDS.quickMatch, 990, { halfSeason: 10 })],
        }),
        { now: NOW },
      );

      expect(result.matchesBand).toBe(20);
    });
  });

  describe('no exact count', () => {
    // Counts chosen so that none of them can be mistaken for a percentage, a minute or a band.
    const COUNTS = { qm: 437, comp: 211, practice: 113, mapDecided: 233, mapWins: 131, dayA: 307, dayB: 149 };
    const exactNumbers = new Set(Object.values(COUNTS).concat(437 + 211 + 113, 307 + 149));

    const busy = deriveCommunityMatches(
      source({
        modes: [
          modeRow(PLAY_MODE_IDS.quickMatch, COUNTS.qm, { durationSumSeconds: 437 * 600, durationN: 437 }),
          modeRow(PLAY_MODE_IDS.competitive, COUNTS.comp, { durationSumSeconds: 211 * 900, durationN: 211 }),
          modeRow(PLAY_MODE_IDS.practice, COUNTS.practice),
        ],
        maps: [
          mapRow('Tokyo 2099', PLAY_MODE_IDS.quickMatch, COUNTS.mapDecided, COUNTS.mapWins),
          mapRow('Klyntar', PLAY_MODE_IDS.quickMatch, mapMatches - 1, 4, { matches: 9 }),
        ],
        days: [dayRow('2026-10-10', COUNTS.dayA), dayRow('2026-10-11', COUNTS.dayB)],
      }),
      { now: NOW },
    );

    function walk(value: unknown, visit: (key: string, value: unknown) => void, key = ''): void {
      visit(key, value);

      if (Array.isArray(value)) {
        value.forEach((item) => walk(item, visit, key));
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([name, item]) => walk(item, visit, name));
      }
    }

    it('returns no number equal to a raw match count', () => {
      const seen: number[] = [];

      walk(busy, (_key, value) => {
        if (typeof value === 'number') {
          seen.push(value);
        }
      });

      expect(seen.length).toBeGreaterThan(0);
      expect(seen.filter((value) => exactNumbers.has(value))).toEqual([]);
    });

    it('has no field named for a count', () => {
      const keys: string[] = [];

      walk(busy, (key) => keys.push(key));

      expect(keys.filter((key) => /^(matches|wins|decided|decidedMatches|matchesCounted|appearances)$/i.test(key))).toEqual([]);
    });

    it('rounds every figure: whole percentages, whole minutes, one volume band', () => {
      expect(busy.matchesBand).toBe(500);
      expect(busy.maps).toEqual([{ map: 'Tokyo 2099', winRate: 56 }]);
      expect(busy.mapsBelowMinimum).toEqual(['Klyntar']);
      expect(busy.modeMix?.map((share) => [share.share, share.averageLengthMinutes])).toEqual([
        [57, 10],
        [28, 15],
        [15, null],
      ]);
      expect(busy.averageLengthMinutes).toBe(12);
      expect(busy.perDay?.map((day) => day.share)).toEqual([67, 33]);
    });

    it('publishes only the allow-listed keys, with no name, id or per-player field anywhere', () => {
      expect(Object.keys(busy).sort()).toEqual([
        'averageLengthMinutes',
        'halfSeason',
        'halfSeasons',
        'inPlaceOf',
        'maps',
        'mapsBelowMinimum',
        'matchesBand',
        'minimums',
        'modeMix',
        'perDay',
        'status',
      ]);
      expect(Object.keys(busy.minimums).sort()).toEqual(['lengthMatches', 'mapMatches', 'overviewMatches', 'recorders']);
      expect(Object.keys(busy.halfSeason!).sort()).toEqual(['endsAt', 'id', 'label', 'startsAt']);
      expect(Object.keys(busy.maps[0]).sort()).toEqual(['map', 'winRate']);
      expect(Object.keys(busy.modeMix![0]).sort()).toEqual(['averageLengthMinutes', 'mode', 'playModeId', 'share']);
      expect(Object.keys(busy.perDay![0]).sort()).toEqual(['day', 'share']);
    });

    it('serialises without NaN or infinity anywhere', () => {
      const numbers: number[] = [];

      walk(busy, (_key, value) => {
        if (typeof value === 'number') {
          numbers.push(value);
        }
      });

      expect(numbers.every(Number.isFinite)).toBeTrue();
    });
  });
});

describe('matchVolumeBand', () => {
  it('is the largest band reached, and null below the smallest', () => {
    expect(matchVolumeBand(0)).toBeNull();
    expect(matchVolumeBand(MATCH_VOLUME_BANDS[0] - 1)).toBeNull();
    expect(matchVolumeBand(20)).toBe(20);
    expect(matchVolumeBand(99)).toBe(50);
    expect(matchVolumeBand(100)).toBe(100);
    expect(matchVolumeBand(10_000)).toBe(5000);
  });
});

describe('playModeName', () => {
  it('names the modes the game reports and says nothing for one it does not', () => {
    expect(playModeName(0)).toBe('Quick Match');
    expect(playModeName(1)).toBe('Competitive');
    expect(playModeName(2)).toBe('Arcade');
    expect(playModeName(3)).toBe('Practice');
    expect(playModeName(42)).toBe('Other');
  });
});
