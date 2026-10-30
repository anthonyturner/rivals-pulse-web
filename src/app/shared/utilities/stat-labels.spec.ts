import { countLabel, halfSeasonFallbackNotice, percentLabel } from './stat-labels';

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
});
