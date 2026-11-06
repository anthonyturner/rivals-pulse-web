import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import { deriveHeroMatchups, HERO_COUNTER_MINIMUM_EDGE } from './hero-matchups';

const pairs = (counters: HeroPairs['bands'][number]['counters'], hulk = { appearances: 100, wins: 40 }): HeroPairs => ({
  status: 'ready',
  minimumMatches: 10,
  priorMatches: 10,
  halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
  inPlaceOf: null,
  bands: [{
    key: 'all',
    label: 'All Ranks',
    decidedMatches: 100,
    heroes: [{ heroId: 1011, ...hulk }, { heroId: 1022, appearances: 100, wins: 50 }],
    counters,
    synergies: [],
  }],
});

describe('deriveHeroMatchups', () => {
  it('uses the canonical pair counts, the shared prior, and the hero overall baseline', () => {
    const result = deriveHeroMatchups(pairs([{ heroId: 1011, enemyHeroId: 1022, matches: 12, appearances: 12, wins: 7 }]));

    expect(result.status).toBe('ready');
    expect(result.matchups[0]).toEqual({
      hero: 'hulk', enemy: 'captain-america', matches: 12, appearances: 12, wins: 7,
      winRate: (7 / 12) * 100,
      shrunkWinRate: (12 / 22) * 100,
      edge: (12 / 22) - (45 / 110),
    });
    expect(result.minimumMatches).toBe(10);
    expect(result.halfSeason?.id).toBe(10.5);
  });

  it('keeps matchups with a meaningful advantage even when their absolute win rate is below 50%', () => {
    const result = deriveHeroMatchups(pairs(
      [{ heroId: 1011, enemyHeroId: 1022, matches: 12, appearances: 12, wins: 2 }],
      { appearances: 100, wins: 10 },
    ));

    expect(result.matchups[0].shrunkWinRate).toBeLessThan(50);
    expect(result.matchups[0].edge).toBeGreaterThanOrEqual(HERO_COUNTER_MINIMUM_EDGE);
  });

  it('preserves the half-season metadata and answers an empty state without a band', () => {
    const result = deriveHeroMatchups({ ...pairs([]), status: 'not-enough-data', bands: [] });

    expect(result.status).toBe('not-enough-data');
    expect(result.matchups).toEqual([]);
    expect(result.halfSeason?.id).toBe(10.5);
  });

  it('leaves unknown heroes out without breaking the other rows', () => {
    const result = deriveHeroMatchups(pairs([
      { heroId: 1011, enemyHeroId: 0, matches: 12, appearances: 12, wins: 9 },
      { heroId: 1011, enemyHeroId: 1022, matches: 12, appearances: 12, wins: 9 },
    ]));

    expect(result.matchups.map(({ enemy }) => enemy)).toEqual(['captain-america']);
  });
});
