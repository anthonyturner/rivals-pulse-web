import {
  COMMUNITY_MATCHES_MINIMUMS,
  deriveCommunityMatches,
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
    expect(result.matchesCounted).toBe(0);
    expect(result.maps).toEqual([]);
    expect(result.modeMix).toBeNull();
    expect(result.averageLengthSeconds).toBeNull();
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
      expect(result.matchesCounted).toBe(40);
      expect(result.modeMix).toEqual([
        { playModeId: 0, mode: 'Quick Match', matches: 30, share: 75, averageLengthSeconds: 600 },
        { playModeId: 1, mode: 'Competitive', matches: 10, share: 25, averageLengthSeconds: 600 },
      ]);
      // 15000 seconds over 25 matches with a length, not over all 40.
      expect(result.averageLengthSeconds).toBe(600);
    });

    it('never counts a missing length as zero', () => {
      const result = deriveCommunityMatches(
        source({ modes: [modeRow(PLAY_MODE_IDS.quickMatch, 100, { durationSumSeconds: 7200, durationN: lengthMatches })] }),
        { now: NOW },
      );

      expect(result.averageLengthSeconds).toBe(720);
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

      expect(result.modeMix?.map((share) => share.averageLengthSeconds)).toEqual([null, null]);
      expect(result.averageLengthSeconds).toBeNull();
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

      expect(result.modeMix?.map((share) => share.averageLengthSeconds)).toEqual([null, null]);
      expect(result.averageLengthSeconds).toBe(500);
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

      expect(result.matchesCounted).toBe(40);
      expect(result.modeMix).toEqual([
        { playModeId: 0, mode: 'Quick Match', matches: 20, share: 100, averageLengthSeconds: null },
      ]);
      expect(result.averageLengthSeconds).toBe(600);
    });

    it('shows no mix below the sample a half-season needs', () => {
      const result = deriveCommunityMatches(
        source({ modes: [modeRow(PLAY_MODE_IDS.quickMatch, overviewMatches - 1)] }),
        { now: NOW },
      );

      expect(result.modeMix).toBeNull();
      expect(result.status).toBe('not-enough-data');
    });

    it('orders the mix by matches, then mode id', () => {
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

      expect(result.maps).toEqual([{ map: 'Tokyo 2099', matches: 12, wins: 7, winRate: (7 / 12) * 100 }]);
    });

    it('lists a map under the minimum without a rate, and never one with no result', () => {
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
      expect(result.mapsBelowMinimum).toEqual([{ map: 'Klyntar', matches: mapMatches - 1 }]);
      expect(result.status).toBe('ready');
    });

    it('orders maps by matches, then name', () => {
      const result = deriveCommunityMatches(
        source({
          maps: [
            mapRow('Yggsgard', PLAY_MODE_IDS.quickMatch, 12, 6),
            mapRow('Central Park', PLAY_MODE_IDS.quickMatch, 20, 10),
            mapRow('Hydra Base', PLAY_MODE_IDS.quickMatch, 12, 6),
          ],
        }),
        { now: NOW },
      );

      expect(result.maps.map((record) => record.map)).toEqual(['Central Park', 'Hydra Base', 'Yggsgard']);
    });

    it('has no win rate that is zero, NaN or infinite because a count is zero', () => {
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
    it('lists the days in order once the half-season has enough matches', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 25)],
          days: [dayRow('2026-10-12', 5), dayRow('2026-10-10', 20), dayRow('2026-09-20', 7, 10)],
        }),
        { now: NOW },
      );

      expect(result.perDay).toEqual([
        { day: '2026-10-10', matches: 20 },
        { day: '2026-10-12', matches: 5 },
      ]);
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
      expect(result.matchesCounted).toBe(60);
      expect(result.maps.map((record) => record.map)).toEqual(['Tokyo 2099']);
    });

    it('shows the current half-season once it has enough, with nothing standing in', () => {
      const result = deriveCommunityMatches(
        source({ ...previous, modes: [...previous.modes, modeRow(PLAY_MODE_IDS.quickMatch, overviewMatches)] }),
        { now: NOW },
      );

      expect(result.halfSeason?.id).toBe(10.5);
      expect(result.inPlaceOf).toBeNull();
      expect(result.matchesCounted).toBe(overviewMatches);
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
        expect(result.matchesCounted).toBe(0);
      }
    });

    it('does not mix one half-season into another', () => {
      const result = deriveCommunityMatches(
        source({
          modes: [modeRow(PLAY_MODE_IDS.quickMatch, 30), modeRow(PLAY_MODE_IDS.quickMatch, 99, { halfSeason: 10 })],
        }),
        { now: NOW },
      );

      expect(result.matchesCounted).toBe(30);
    });
  });

  it('publishes only the allow-listed keys, with no name, id or per-player field anywhere', () => {
    const result = deriveCommunityMatches(
      source({
        modes: [modeRow(PLAY_MODE_IDS.quickMatch, 40, { durationSumSeconds: 24000, durationN: 40 })],
        maps: [
          mapRow('Tokyo 2099', PLAY_MODE_IDS.quickMatch, 12, 6),
          mapRow('Klyntar', PLAY_MODE_IDS.quickMatch, 3, 1),
        ],
        days: [dayRow('2026-10-10', 40)],
      }),
      { now: NOW },
    );

    expect(Object.keys(result).sort()).toEqual([
      'averageLengthSeconds',
      'halfSeason',
      'halfSeasons',
      'inPlaceOf',
      'maps',
      'mapsBelowMinimum',
      'matchesCounted',
      'minimums',
      'modeMix',
      'perDay',
      'status',
    ]);
    expect(Object.keys(result.minimums).sort()).toEqual(['lengthMatches', 'mapMatches', 'overviewMatches']);
    expect(Object.keys(result.halfSeason!).sort()).toEqual(['endsAt', 'id', 'label', 'startsAt']);
    expect(Object.keys(result.maps[0]).sort()).toEqual(['map', 'matches', 'winRate', 'wins']);
    expect(Object.keys(result.mapsBelowMinimum[0]).sort()).toEqual(['map', 'matches']);
    expect(Object.keys(result.modeMix![0]).sort()).toEqual([
      'averageLengthSeconds',
      'matches',
      'mode',
      'playModeId',
      'share',
    ]);
    expect(Object.keys(result.perDay![0]).sort()).toEqual(['day', 'matches']);
  });

  it('serialises without NaN or infinity anywhere', () => {
    const result = deriveCommunityMatches(
      source({
        modes: [modeRow(PLAY_MODE_IDS.quickMatch, 40)],
        maps: [mapRow('Tokyo 2099', PLAY_MODE_IDS.quickMatch, 12, 0)],
        days: [dayRow('2026-10-10', 40)],
      }),
      { now: NOW },
    );

    const numbers: number[] = [];
    JSON.stringify(result, (_key, value: unknown) => {
      if (typeof value === 'number') {
        numbers.push(value);
      }

      return value;
    });
    // JSON.stringify would turn NaN into null, so it is the replacer that sees the number itself.
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every(Number.isFinite)).toBeTrue();
    expect(result.maps[0].winRate).toBe(0);
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
