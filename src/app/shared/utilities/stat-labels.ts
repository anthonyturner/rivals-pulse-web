import type { HeroStats } from '../../../contracts/hero-stats.model';

/** A percentage to one decimal place, such as `54.2%`. */
export function percentLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** A whole percentage, such as `58%`. */
export function wholePercentLabel(value: number): string {
  return `${value}%`;
}

/** What a figure no recorded line carried reads as. */
export const NOT_RECORDED = 'Not recorded';

/** A KDA to two decimal places, such as `2.35`, or "Not recorded". */
export function kdaLabel(kda: number | null): string {
  return kda === null ? NOT_RECORDED : kda.toFixed(2);
}

/** Final hits per match to one decimal place, such as `4.3`, or "Not recorded". */
export function finalHitsLabel(finalHitsAverage: number | null): string {
  return finalHitsAverage === null ? NOT_RECORDED : finalHitsAverage.toFixed(1);
}

/** A count with its noun, such as `1 match` or `4 matches`. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The label of the site's one "matches counted" figure, always saying what it covers, such as
 * `Matches counted · Season 10.5` or `Matches counted · all seasons`. Every page states that figure
 * through this, so two figures with this label never cover different things.
 */
export function matchesCountedLabel(count: number, scope: string): string {
  return `${count === 1 ? 'Match' : 'Matches'} counted · ${scope}`;
}

/**
 * The count the win rates, tiers and pick rates are worked out from, such as `146 matches with a
 * result`. It is a different count from "matches counted", which includes matches that ended with
 * no win or loss recorded, so it never uses that label.
 */
export function decidedMatchesLabel(count: number): string {
  return `${countLabel(count, 'match', 'matches')} with a result`;
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
