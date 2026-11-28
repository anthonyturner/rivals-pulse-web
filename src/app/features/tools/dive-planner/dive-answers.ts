import { COUNTER_MIN_EDGE_POINTS, type HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { Hero } from '../../heroes/hero.model';

/** A hero that does better than usual against at least one of the chosen enemy heroes. */
export interface MultiThreatAnswer {
  hero: Hero;
  coveredThreats: Hero[];
}

/**
 * The heroes that do better than usual (by the community counter rule) against the most of the
 * chosen enemy heroes. A hero is never its own answer, and one that does not against any of them is
 * left out.
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

/**
 * Why no hero answers the chosen threats, naming how many heroes were checked: the heroes with the
 * minimum of recorded matches against at least one threat, so "none" reads as a finding.
 */
export function noAnswerMessage(threats: Hero[], matchups: HeroMatchups): string {
  const threatIds = new Set(threats.map((threat) => threat.id));
  const checked = new Set(
    matchups.matchups.filter((matchup) => threatIds.has(matchup.enemy) && !threatIds.has(matchup.hero)).map((matchup) => matchup.hero),
  );
  const recorded = `${matchups.minimumMatches} or more recorded matches`;

  if (checked.size === 0) {
    return `No hero has ${recorded} against these threats yet.`;
  }

  return `No hero does at least ${COUNTER_MIN_EDGE_POINTS} points better than it usually does against these threats, across the ${checked.size === 1 ? '1 hero' : `${checked.size} heroes`} with ${recorded} against them.`;
}
