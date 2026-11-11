import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { Hero } from '../../heroes/hero.model';

/** A hero with a winning record against at least one of the chosen enemy heroes. */
export interface MultiThreatAnswer {
  hero: Hero;
  coveredThreats: Hero[];
}

/**
 * The heroes with a winning record against the most of the chosen enemy heroes. A hero is never
 * its own answer, and one with no winning record against any of them is left out.
 */
export function answersTo(threats: Hero[], heroes: Hero[], matchups: HeroMatchups, limit = 6): MultiThreatAnswer[] {
  if (!threats.length) {
    return [];
  }

  return heroes
    .filter((candidate) => !threats.some((threat) => threat.id === candidate.id))
    .map((candidate) => ({
      hero: candidate,
      coveredThreats: threats.filter((threat) =>
        matchups.matchups.some(
          (matchup) => matchup.hero === candidate.id && matchup.enemy === threat.id && matchup.isCounter,
        ),
      ),
    }))
    .filter((answer) => answer.coveredThreats.length > 0)
    .sort(
      (a, b) => b.coveredThreats.length - a.coveredThreats.length || a.hero.name.localeCompare(b.hero.name),
    )
    .slice(0, limit);
}
