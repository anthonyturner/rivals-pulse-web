import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import type { HeroSynergies, HeroSynergy } from '../../../contracts/hero-synergies.model.ts';
import { shrunkWinRate } from '../stats/hero-stats.ts';

/**
 * The pairs that played together, named by hero and with their rates, for pages that cannot map the
 * game's numeric hero ids. `/api/hero-pairs` stays the counts the Pulse Atlas publishes; this reads
 * the same counts and adds only the names and the two rates.
 *
 * A pair whose hero has no entry in `heroSlugByGameId` is left out: the derivation of the pairs has
 * already dropped the game ids it cannot map, and logged them.
 */
export function deriveHeroSynergies(
  pairs: HeroPairs,
  heroSlugByGameId: ReadonlyMap<number, string>,
): HeroSynergies {
  const band = pairs.bands.find(({ key }) => key === 'all');
  const synergies = (band?.synergies ?? []).flatMap(
    ({ heroId, allyHeroId, matches, appearances, wins }): HeroSynergy[] => {
      const hero = heroSlugByGameId.get(heroId);
      const ally = heroSlugByGameId.get(allyHeroId);

      if (hero === undefined || ally === undefined || appearances <= 0) {
        return [];
      }

      return [
        {
          hero,
          ally,
          matches,
          appearances,
          wins,
          winRate: (wins / appearances) * 100,
          shrunkWinRate: shrunkWinRate(wins, appearances, pairs.priorMatches) * 100,
        },
      ];
    },
  );

  return {
    status: synergies.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: pairs.minimumMatches,
    halfSeason: pairs.halfSeason,
    inPlaceOf: pairs.inPlaceOf,
    halfSeasons: pairs.halfSeasons,
    mode: pairs.mode,
    modes: pairs.modes,
    synergies: synergies.sort((a, b) => a.hero.localeCompare(b.hero) || a.ally.localeCompare(b.ally)),
  };
}
