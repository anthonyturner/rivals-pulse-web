import { countLabel, halfSeasonFallbackNotice, percentLabel, placementRequirementLabel } from './stat-labels';

describe('stat labels', () => {
  it('rounds a percentage to one decimal place', () => {
    expect(percentLabel(54.1666)).toBe('54.2%');
  });

  it('uses the singular only for exactly one', () => {
    expect(countLabel(1, 'match', 'matches')).toBe('1 match');
    expect(countLabel(0, 'match', 'matches')).toBe('0 matches');
    expect(countLabel(4, 'match', 'matches')).toBe('4 matches');
  });

  it('names both half-seasons in the fallback notice', () => {
    expect(halfSeasonFallbackNotice('Season 10.5', 'Season 10')).toBe(
      "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
    );
  });

  it('names the mode in the fallback notice when one mode is counted on its own', () => {
    expect(halfSeasonFallbackNotice('Season 10.5', 'Season 10', 'Competitive')).toBe(
      "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
    );
  });

  describe('placementRequirementLabel', () => {
    const base = { minimumMatches: 10, minimumPlayers: 2, belowMinimum: [] };

    it('names the players beside the appearances', () => {
      expect(placementRequirementLabel(base)).toBe('10 appearances and 2 players');
    });

    it('names the appearances alone when the answer states no players', () => {
      expect(placementRequirementLabel({ ...base, minimumPlayers: undefined })).toBe('10 appearances');
    });

    it('names the appearances alone for a half-season whose heroes carry no player count', () => {
      expect(placementRequirementLabel({ ...base, belowMinimum: [{ hero: 'storm', appearances: 4 }] })).toBe(
        '10 appearances',
      );
    });

    it('names the players when any hero below the minimum carries a count', () => {
      expect(
        placementRequirementLabel({
          ...base,
          belowMinimum: [
            { hero: 'storm', appearances: 4 },
            { hero: 'hulk', appearances: 12, players: 1 },
          ],
        }),
      ).toBe('10 appearances and 2 players');
    });
  });
});
