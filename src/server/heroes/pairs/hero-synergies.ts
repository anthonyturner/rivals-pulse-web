import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import type { HeroSynergies, HeroSynergy } from '../../../contracts/hero-synergies.model.ts';
import type { HeroPlacement } from '../catalog/index.ts';
import { shrunkWinRate } from '../stats/hero-stats.ts';

/**
 * The pairs that played together, named by hero and with their rates, for pages that cannot map the
 * game's numeric hero ids. `/api/hero-pairs` stays the counts the Pulse Atlas publishes; this reads
 * the same counts and adds only the names and the two rates.
 *
 * `pairs` must be counted per game id, with a role form of a hero the game splits by role (Deadpool)
 * kept apart, as `getHeroSynergies` reads them. `placementByGameId` names each id and says the role
 * of a form, so Deadpool's duos are listed under the role that was played. A pair whose hero has no
 * entry there is left out, and so is a hero paired with another form of itself: the derivation of
 * the pairs has already dropped the game ids it cannot map, and logged them.
 */
export function deriveHeroSynergies(
  pairs: HeroPairs,
  placementByGameId: ReadonlyMap<number, HeroPlacement>,
): HeroSynergies {
  const band = pairs.bands.find(({ key }) => key === 'all');
  const synergies = (band?.synergies ?? []).flatMap(
    ({ heroId, allyHeroId, matches, appearances, wins }): HeroSynergy[] => {
      const hero = placementByGameId.get(heroId);
      const ally = placementByGameId.get(allyHeroId);

      if (hero === undefined || ally === undefined || hero.hero === ally.hero || appearances <= 0) {
        return [];
      }

      return [
        {
          hero: hero.hero,
          ...(hero.role === undefined ? {} : { heroRole: hero.role }),
          ally: ally.hero,
          ...(ally.role === undefined ? {} : { allyRole: ally.role }),
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
    synergies: synergies.sort(
      (a, b) =>
        a.hero.localeCompare(b.hero) ||
        a.ally.localeCompare(b.ally) ||
        (a.heroRole ?? '').localeCompare(b.heroRole ?? '') ||
        (a.allyRole ?? '').localeCompare(b.allyRole ?? ''),
    ),
  };
}
