import type { HeroStats } from '../../../contracts/hero-stats.model';

/** A percentage to one decimal place, such as `54.2%`. */
export function percentLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** A count with its noun, such as `1 match` or `4 matches`. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The sentence that says a previous half-season's numbers stand in for the current one's. Give
 * `modeLabel` when one mode is counted on its own, so the sentence says which mode ran short.
 */
export function halfSeasonFallbackNotice(currentLabel: string, shownLabel: string | null, modeLabel?: string): string {
  const shown = shownLabel ?? 'the previous half-season';

  return modeLabel === undefined
    ? `${currentLabel} does not have enough data yet, so these are ${shown}'s numbers until it does.`
    : `${currentLabel} does not have enough ${modeLabel} data yet, so these are ${shown}'s ${modeLabel} numbers until it does.`;
}

/**
 * What a hero needs before it is placed, such as `10 appearances and 2 players`. The players are
 * left out of an answer that does not state them, and of a half-season whose heroes below the
 * minimum all carry no player count: that half-season was never counted and places on appearances
 * alone.
 */
export function placementRequirementLabel(
  stats: Pick<HeroStats, 'minimumMatches' | 'minimumPlayers' | 'belowMinimum'>,
): string {
  const appearances = countLabel(stats.minimumMatches, 'appearance', 'appearances');
  const playersNeverCounted =
    stats.belowMinimum.length > 0 && stats.belowMinimum.every((entry) => entry.players === undefined);

  return stats.minimumPlayers === undefined || playersNeverCounted
    ? appearances
    : `${appearances} and ${countLabel(stats.minimumPlayers, 'player', 'players')}`;
}
