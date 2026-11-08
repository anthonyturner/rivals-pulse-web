import type { HeroPairs, HeroPairsSynergy } from '../../../contracts/hero-pairs.model.ts';
import type { HeroPlacement } from '../catalog/index.ts';
import { deriveHeroSynergies } from './hero-synergies';

const DEADPOOL = 1057;
const DEADPOOL_VANGUARD = 10571;
const DEADPOOL_DUELIST = 10572;
const DEADPOOL_STRATEGIST = 10573;

const SLUGS = new Map<number, HeroPlacement>([
  [1011, { hero: 'hulk' }],
  [1022, { hero: 'captain-america' }],
  [1033, { hero: 'black-widow' }],
  [DEADPOOL, { hero: 'deadpool' }],
  [DEADPOOL_VANGUARD, { hero: 'deadpool', role: 'Vanguard' }],
  [DEADPOOL_DUELIST, { hero: 'deadpool', role: 'Duelist' }],
  [DEADPOOL_STRATEGIST, { hero: 'deadpool', role: 'Strategist' }],
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

  it('carries the half-seasons and modes the pairs offer, so a page can fill its pickers', () => {
    const halfSeasons = [{ id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null }];
    const modes = [{ id: 'competitive' as const, label: 'Competitive', decidedMatches: 80 }];
    const result = deriveHeroSynergies(pairsOf([synergy(1011, 1033, 20, 15)], { halfSeasons, mode: 'competitive', modes }), SLUGS);

    expect([result.halfSeasons, result.mode, result.modes]).toEqual([halfSeasons, 'competitive', modes]);
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

  describe('for a hero the game splits by role', () => {
    for (const [gameId, role] of [
      [DEADPOOL_VANGUARD, 'Vanguard'],
      [DEADPOOL_DUELIST, 'Duelist'],
      [DEADPOOL_STRATEGIST, 'Strategist'],
    ] as const) {
      it(`names the ${role} form's pair with the role it was played in`, () => {
        const [pair] = deriveHeroSynergies(pairsOf([synergy(1011, gameId, 20, 15)]), SLUGS).synergies;

        expect(pair.hero).toBe('hulk');
        expect('heroRole' in pair).toBeFalse();
        expect(pair.ally).toBe('deadpool');
        expect(pair.allyRole).toBe(role);
      });
    }

    it('names the role on the hero side too', () => {
      const [pair] = deriveHeroSynergies(pairsOf([synergy(DEADPOOL_STRATEGIST, 1033, 20, 15)]), SLUGS).synergies;

      expect(pair).toEqual(jasmine.objectContaining({ hero: 'deadpool', heroRole: 'Strategist', ally: 'black-widow' }));
    });

    it('lists the base id with no role, so a page cannot place it', () => {
      const [pair] = deriveHeroSynergies(pairsOf([synergy(DEADPOOL, 1033, 20, 15)]), SLUGS).synergies;

      expect(pair.hero).toBe('deadpool');
      expect('heroRole' in pair).toBeFalse();
    });

    it('keeps each form as its own pair with the same hero, ordered by role', () => {
      const result = deriveHeroSynergies(
        pairsOf([
          synergy(1011, DEADPOOL_STRATEGIST, 12, 6),
          synergy(1011, DEADPOOL_VANGUARD, 14, 7),
          synergy(1011, DEADPOOL, 13, 6),
        ]),
        SLUGS,
      );

      expect(result.synergies.map(({ ally, allyRole, matches }) => `${ally}/${allyRole ?? '-'}/${matches}`)).toEqual([
        'deadpool/-/13',
        'deadpool/Strategist/12',
        'deadpool/Vanguard/14',
      ]);
    });

    it('leaves out a hero paired with another form of itself', () => {
      const result = deriveHeroSynergies(pairsOf([synergy(DEADPOOL_VANGUARD, DEADPOOL_STRATEGIST, 12, 6)]), SLUGS);

      expect(result.synergies).toEqual([]);
    });
  });
});
