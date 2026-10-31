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
