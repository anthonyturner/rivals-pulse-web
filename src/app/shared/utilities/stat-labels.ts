/** A percentage to one decimal place, such as `54.2%`. */
export function percentLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** A count with its noun, such as `1 match` or `4 matches`. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** The sentence that says a previous half-season's numbers stand in for the current one's. */
export function halfSeasonFallbackNotice(currentLabel: string, shownLabel: string | null): string {
  return `${currentLabel} does not have enough data yet, so these are ${shownLabel ?? 'the previous half-season'}'s numbers until it does.`;
}
