import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
import type { HeroPairs, HeroPairsCounter } from '../../../contracts/hero-pairs.model.ts';
import { heroSlugByGameId } from '../catalog/index.ts';

/** Minimum advantage over a hero's own overall shrunk win rate, as used by the overlay. */
export const HERO_COUNTER_MINIMUM_EDGE = 0.03;

/** Converts the canonical pair dataset into the site's existing matchup response shape. */
export function deriveHeroMatchups(pairs: HeroPairs): HeroMatchups {
  const band = pairs.bands.find(({ key }) => key === 'all');
  const overall = new Map(band?.heroes.map((hero) => [hero.heroId, hero]));
  const matchups = (band?.counters ?? [])
    .flatMap((counter) => {
      const hero = heroSlugByGameId.get(counter.heroId);
      const enemy = heroSlugByGameId.get(counter.enemyHeroId);
      const baseline = overall.get(counter.heroId);

      if (!hero || !enemy || !baseline || counter.appearances <= 0 || baseline.appearances <= 0) {
        return [];
      }

      return [toMatchup(hero, enemy, counter, baseline.wins, baseline.appearances, pairs.priorMatches)];
    })
    .sort((a, b) => a.hero.localeCompare(b.hero) || a.enemy.localeCompare(b.enemy));

  return {
    status: matchups.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: pairs.minimumMatches,
    halfSeason: pairs.halfSeason,
    inPlaceOf: pairs.inPlaceOf,
    matchups,
  };
}

function toMatchup(
  hero: string,
  enemy: string,
  counter: HeroPairsCounter,
  overallWins: number,
  overallAppearances: number,
  priorMatches: number,
): HeroMatchup {
  const shrunkRate = (wins: number, appearances: number) => (wins + priorMatches / 2) / (appearances + priorMatches);
  const matchupRate = shrunkRate(counter.wins, counter.appearances);
  const overallRate = shrunkRate(overallWins, overallAppearances);

  return {
    hero,
    enemy,
    matches: counter.matches,
    appearances: counter.appearances,
    wins: counter.wins,
    winRate: (counter.wins / counter.appearances) * 100,
    shrunkWinRate: matchupRate * 100,
    edge: matchupRate - overallRate,
  };
}
