import type { HeroPairs, HeroPairsSynergy } from '../../../contracts/hero-pairs.model.ts';
import { deriveHeroSynergies } from './hero-synergies';

const SLUGS = new Map<number, string>([
  [1011, 'hulk'],
  [1022, 'captain-america'],
  [1033, 'black-widow'],
]);

function synergy(heroId: number, allyHeroId: number, matches: number, wins: number): HeroPairsSynergy {
  return { heroId, allyHeroId, matches, appearances: matches, wins };
}

function pairsOf(synergies: HeroPairsSynergy[], overrides: Partial<HeroPairs> = {}): HeroPairs {
  return {
    status: synergies.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    priorMatches: 10,
    halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
    inPlaceOf: null,
    bands: [{ key: 'all', label: 'All Ranks', decidedMatches: 80, heroes: [], counters: [], synergies }],
    ...overrides,
  };
}

describe('deriveHeroSynergies', () => {
  it('names each pair by hero and works out its win rate and its shrunk win rate', () => {
    const result = deriveHeroSynergies(pairsOf([synergy(1011, 1033, 20, 15)]), SLUGS);

    expect(result.status).toBe('ready');
    expect(result.minimumMatches).toBe(10);
    expect(result.halfSeason?.id).toBe(10.5);
    expect(result.synergies).toEqual([
      {
        hero: 'hulk',
        ally: 'black-widow',
        matches: 20,
        appearances: 20,
        wins: 15,
        winRate: 75,
        shrunkWinRate: ((15 + 5) / (20 + 10)) * 100,
      },
    ]);
  });

  it('works the rates over team occurrences, which are twice the matches when both teams field the pair', () => {
    const both: HeroPairsSynergy = { heroId: 1011, allyHeroId: 1033, matches: 12, appearances: 24, wins: 12 };
    const [pair] = deriveHeroSynergies(pairsOf([both]), SLUGS).synergies;

    expect(pair.matches).toBe(12);
    expect(pair.appearances).toBe(24);
    expect(pair.winRate).toBe(50);
    expect(pair.shrunkWinRate).toBe(50);
  });

  it('shrinks toward 50% by the prior the pairs carry', () => {
    const [pair] = deriveHeroSynergies(pairsOf([synergy(1011, 1033, 20, 20)], { priorMatches: 30 }), SLUGS).synergies;

    expect(pair.shrunkWinRate).toBe(((20 + 15) / (20 + 30)) * 100);
  });

  it('sorts by hero and then ally, which is not a ranking', () => {
    const result = deriveHeroSynergies(
      pairsOf([synergy(1022, 1033, 12, 6), synergy(1011, 1033, 12, 6), synergy(1011, 1022, 12, 6)]),
      SLUGS,
    );

    expect(result.synergies.map(({ hero, ally }) => `${hero}+${ally}`)).toEqual([
      'captain-america+black-widow',
      'hulk+black-widow',
      'hulk+captain-america',
    ]);
  });

  it('leaves out a pair with a hero it cannot name', () => {
    const result = deriveHeroSynergies(pairsOf([synergy(1011, 9999, 12, 6), synergy(1011, 1033, 12, 6)]), SLUGS);

    expect(result.synergies.map(({ ally }) => ally)).toEqual(['black-widow']);
  });

  it('is the empty state when there is no pair, keeping the half-season it was asked about', () => {
    const result = deriveHeroSynergies(pairsOf([]), SLUGS);

    expect(result.status).toBe('not-enough-data');
    expect(result.synergies).toEqual([]);
    expect(result.halfSeason?.id).toBe(10.5);
  });

  it('is the empty state when the answer has no all-ranks band', () => {
    const result = deriveHeroSynergies(pairsOf([], { bands: [] }), SLUGS);

    expect(result.status).toBe('not-enough-data');
  });

  it('carries the half-season it stands in for', () => {
    const inPlaceOf = { id: 11, label: 'Season 11', startsAt: null, endsAt: null };

    expect(deriveHeroSynergies(pairsOf([synergy(1011, 1033, 12, 6)], { inPlaceOf }), SLUGS).inPlaceOf).toEqual(inPlaceOf);
  });
});
