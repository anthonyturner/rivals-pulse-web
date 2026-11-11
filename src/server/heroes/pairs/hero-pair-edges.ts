import { COUNTER_MIN_EDGE_POINTS } from '../../../contracts/hero-matchups.model.ts';
import type { HeroPairsBand, HeroPairsCounter } from '../../../contracts/hero-pairs.model.ts';
import { estimateWinRatePriors } from '../stats/win-rate-prior.ts';

/**
 * The rule that decides which hero-against-enemy pairs count as a counter, for every reader of the
 * pair counts. The overlay applies it to the Pulse Atlas `community-stats` file (its
 * `community-stats.dataset.ts`) and the website applies it here, to the same counts, so a hero is a
 * counter in one place exactly when it is in the other. Change both together.
 */

/** How far above a hero's own record (0.03 is 3 percentage points) a pair must be before it counts as a counter. */
export const MIN_COUNTER_EDGE = COUNTER_MIN_EDGE_POINTS / 100;

/** Whether an edge reaches `MIN_COUNTER_EDGE`, with a hair of tolerance so exactly 3 points counts despite floating-point rounding. */
export function meetsMinimumEdge(edge: number): boolean {
  return edge >= MIN_COUNTER_EDGE - 1e-9;
}

/** A counter pair with its win rate and its edge over the hero's own record, both as shares from 0 to 1. */
export interface HeroCounterEdge extends HeroPairsCounter {
  /** The pair's win rate pulled toward the band's average by a prior estimated from the band's heroes. */
  shrunkWinRate: number;
  /** `shrunkWinRate` minus the hero's own shrunk win rate in the band; negative when the pairing hurts. */
  edge: number;
}

interface Counts {
  appearances: number;
  wins: number;
}

/**
 * Every counter pair of a band with its edge. One prior, estimated from the band's heroes (no role
 * grouping), shrinks the pairs and the heroes alike, so the edge compares like with like. A pair
 * whose hero has no usable record in the band cannot be judged and is left out, as are a hero
 * against itself and a pair with counts that cannot be a record. The `minimumMatches` of the
 * counts is applied to the pairs, whatever the list holds.
 */
export function counterEdges(band: HeroPairsBand, minimumMatches: number): HeroCounterEdge[] {
  const heroes = new Map<number, Counts>();

  for (const hero of band.heroes) {
    if (isRecord(hero) && !heroes.has(hero.heroId)) {
      heroes.set(hero.heroId, hero);
    }
  }

  const priors = estimateWinRatePriors([...heroes.values()].map(({ appearances, wins }) => ({ matches: appearances, wins })));
  const shrunk = ({ appearances, wins }: Counts): number => priors.estimate({ matches: appearances, wins }).rate;
  const seen = new Set<string>();

  return band.counters.flatMap((counter): HeroCounterEdge[] => {
    const hero = heroes.get(counter.heroId);
    const pair = `${counter.heroId}:${counter.enemyHeroId}`;

    if (
      hero === undefined ||
      counter.matches < minimumMatches ||
      counter.heroId === counter.enemyHeroId ||
      !isRecord(counter) ||
      seen.has(pair)
    ) {
      return [];
    }

    seen.add(pair);
    const shrunkWinRate = shrunk(counter);

    return [{ ...counter, shrunkWinRate, edge: shrunkWinRate - shrunk(hero) }];
  });
}

function isRecord({ appearances, wins }: Counts): boolean {
  return Number.isFinite(appearances) && Number.isFinite(wins) && appearances > 0 && wins >= 0 && wins <= appearances;
}
