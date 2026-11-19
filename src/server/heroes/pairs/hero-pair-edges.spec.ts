import type { HeroPairsBand, HeroPairsCounter, HeroPairsHero } from '../../../contracts/hero-pairs.model';
import { estimateWinRatePriors } from '../stats/win-rate-prior';
import { counterEdges, meetsMinimumEdge, MIN_COUNTER_EDGE } from './hero-pair-edges';

const MINIMUM = 10;

function hero(heroId: number, appearances: number, wins: number): HeroPairsHero {
  return { heroId, appearances, wins };
}

function counter(heroId: number, enemyHeroId: number, matches: number, wins: number): HeroPairsCounter {
  return { heroId, enemyHeroId, matches, appearances: matches, wins };
}

function bandOf(heroes: HeroPairsHero[], counters: HeroPairsCounter[]): HeroPairsBand {
  return { key: 'all', label: 'All Ranks', decidedMatches: 500, heroes, counters, synergies: [] };
}

/** Four heroes are too few to estimate a prior from, so each record is pulled 60 pretend matches toward 50%. */
const FEW_HEROES = [hero(1, 100, 60), hero(2, 100, 50), hero(3, 40, 10), hero(4, 40, 20)];

describe('the community counter rule', () => {
  it('asks for 3 points over the hero\'s own record', () => {
    expect(MIN_COUNTER_EDGE).toBe(0.03);
  });

  it('lets exactly 3 points through despite floating-point rounding, and nothing below', () => {
    expect(meetsMinimumEdge(0.03)).toBeTrue();
    expect(meetsMinimumEdge(0.03 - 1e-10)).toBeTrue();
    expect(meetsMinimumEdge(0.0299)).toBeFalse();
    expect(meetsMinimumEdge(-0.2)).toBeFalse();
  });
});

describe('counterEdges', () => {
  it('shrinks the pair and the hero alike and takes their difference', () => {
    // Hero 1 is (60 + 30) / (100 + 60) = 0.5625; the pair is (18 + 30) / (20 + 60) = 0.6.
    const [edge] = counterEdges(bandOf(FEW_HEROES, [counter(1, 2, 20, 18)]), MINIMUM);

    expect(edge.shrunkWinRate).toBeCloseTo(0.6, 12);
    expect(edge.edge).toBeCloseTo(0.0375, 12);
    expect(meetsMinimumEdge(edge.edge)).toBeTrue();
  });

  it('keeps the counts and names of the pair it was given', () => {
    const [edge] = counterEdges(bandOf(FEW_HEROES, [counter(1, 2, 20, 18)]), MINIMUM);

    expect(edge).toEqual(jasmine.objectContaining({ heroId: 1, enemyHeroId: 2, matches: 20, appearances: 20, wins: 18 }));
  });

  it('gives a pair a negative edge when it does worse than the hero usually does', () => {
    const [edge] = counterEdges(bandOf(FEW_HEROES, [counter(1, 3, 20, 14)]), MINIMUM);

    expect(edge.edge).toBeCloseTo(0.55 - 0.5625, 12);
    expect(meetsMinimumEdge(edge.edge)).toBeFalse();
  });

  it('counts a pair whose edge is exactly 3 points', () => {
    // Hero 2 is 0.5; the pair is (23 + 30) / (40 + 60) = 0.53.
    const [edge] = counterEdges(bandOf(FEW_HEROES, [counter(2, 1, 40, 23)]), MINIMUM);

    expect(meetsMinimumEdge(edge.edge)).toBeTrue();
  });

  it('uses a prior estimated from the heroes once there are enough to estimate one', () => {
    const heroes = [hero(1, 200, 120), hero(2, 200, 100), hero(3, 200, 80), hero(4, 200, 110), hero(5, 200, 90), hero(6, 200, 100)];
    const priors = estimateWinRatePriors(heroes.map(({ appearances, wins }) => ({ matches: appearances, wins })));
    const [edge] = counterEdges(bandOf(heroes, [counter(1, 2, 30, 24)]), MINIMUM);

    expect(priors.estimated).toBeTrue();
    expect(edge.shrunkWinRate).toBeCloseTo(priors.estimate({ matches: 30, wins: 24 }).rate, 12);
    expect(edge.edge).toBeCloseTo(
      priors.estimate({ matches: 30, wins: 24 }).rate - priors.estimate({ matches: 200, wins: 120 }).rate,
      12,
    );
  });

  it('leaves out a pair below the minimum, whatever the list holds', () => {
    const edges = counterEdges(bandOf(FEW_HEROES, [counter(1, 2, MINIMUM - 1, MINIMUM - 1), counter(1, 3, MINIMUM, MINIMUM)]), MINIMUM);

    expect(edges.map((edge) => edge.enemyHeroId)).toEqual([3]);
  });

  it('leaves out a pair whose hero has no record in the band, and a hero against itself', () => {
    const edges = counterEdges(bandOf(FEW_HEROES, [counter(9, 1, 20, 18), counter(1, 1, 20, 18), counter(1, 2, 20, 18)]), MINIMUM);

    expect(edges.map((edge) => `${edge.heroId}>${edge.enemyHeroId}`)).toEqual(['1>2']);
  });

  it('leaves out counts that cannot be a record and a pair seen twice', () => {
    const edges = counterEdges(
      bandOf(FEW_HEROES, [
        counter(1, 2, 20, 18),
        counter(1, 2, 30, 1),
        { heroId: 1, enemyHeroId: 3, matches: 20, appearances: 0, wins: 0 },
        { heroId: 1, enemyHeroId: 4, matches: 20, appearances: 10, wins: 11 },
      ]),
      MINIMUM,
    );

    expect(edges.map((edge) => [edge.enemyHeroId, edge.matches])).toEqual([[2, 20]]);
  });

  it('ignores a hero record that cannot be one, so it never skews the prior', () => {
    const edges = counterEdges(bandOf([...FEW_HEROES, hero(5, 0, 0), hero(6, 10, 11)], [counter(5, 1, 20, 10)]), MINIMUM);

    expect(edges).toEqual([]);
  });

  it('is empty for a band with no counter', () => {
    expect(counterEdges(bandOf(FEW_HEROES, []), MINIMUM)).toEqual([]);
  });
});
