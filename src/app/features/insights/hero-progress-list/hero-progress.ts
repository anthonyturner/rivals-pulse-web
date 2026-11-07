import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';

/** A hero that has appearances but not yet the minimum for a number to be shown. */
export interface HeroProgressRow extends HeroCellView {
  appearances: number;
  progressLabel: string;
  progressPercent: number;
}

export function heroProgressRow(
  hero: string,
  appearances: number,
  minimum: number,
  identities: HeroIdentities,
): HeroProgressRow {
  return {
    ...heroCell(hero, identities),
    appearances,
    progressLabel: `${appearances} of ${minimum}`,
    progressPercent: minimum > 0 ? Math.min(100, (appearances / minimum) * 100) : 0,
  };
}

/** The heroes still short of the minimum, closest first. A hero never seen is left out. */
export function heroProgressRows(
  belowMinimum: readonly { hero: string; appearances: number }[],
  minimum: number,
  identities: HeroIdentities,
): HeroProgressRow[] {
  return belowMinimum
    .filter((entry) => entry.appearances > 0)
    .map((entry) => heroProgressRow(entry.hero, entry.appearances, minimum, identities))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));
}
