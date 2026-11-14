import type { ParamMap } from '@angular/router';

import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../../shared/utilities/play-modes';

/** The two ways the Heroes tab lays out the same hero numbers. */
export type HeroStatsViewId = 'table' | 'tiers';

/** The query parameters that hold the Heroes tab's choices, so every one of them can be linked. */
export const HERO_STATS_VIEW_PARAM = 'view';
export const HERO_STATS_SEASON_PARAM = 'season';
export const HERO_STATS_MODE_PARAM = 'mode';

export const DEFAULT_HERO_STATS_VIEW: HeroStatsViewId = 'table';

/** Which numbers to count: a half-season (`undefined` for the current one) and a game mode. */
export interface HeroStatsScope {
  season: number | undefined;
  mode: HeroStatsModeId;
}

const MODE_IDS: readonly HeroStatsModeId[] = ['all', 'quick-match', 'competitive', 'arcade', 'practice'];

/** The layout the address names; a missing or unknown one is the table. */
export function heroStatsView(params: ParamMap): HeroStatsViewId {
  return params.get(HERO_STATS_VIEW_PARAM) === 'tiers' ? 'tiers' : DEFAULT_HERO_STATS_VIEW;
}

/**
 * The half-season and mode the address names. A half-season id is a positive whole or half number
 * such as 10 or 10.5; anything else is ignored, as is a mode the site does not count, so a mistyped
 * address shows the current numbers instead of an error.
 */
export function heroStatsScope(params: ParamMap): HeroStatsScope {
  const season = params.get(HERO_STATS_SEASON_PARAM);
  const mode = params.get(HERO_STATS_MODE_PARAM);

  return {
    season: season !== null && /^(?:[1-9]\d*(?:\.5)?|0\.5)$/.test(season) ? Number(season) : undefined,
    mode: MODE_IDS.find((id) => id === mode) ?? DEFAULT_MODE_ID,
  };
}

export function sameHeroStatsScope(a: HeroStatsScope, b: HeroStatsScope): boolean {
  return a.season === b.season && a.mode === b.mode;
}

/**
 * The query parameters for a choice, to merge into the address. A choice that is the default is
 * `null`, which removes it, so the plain address stays the one that shows the table of the current
 * half-season and the default mode.
 */
export function heroStatsQuery(choice: {
  view?: HeroStatsViewId;
  season?: number | undefined;
  mode?: HeroStatsModeId;
}): Record<string, string | null> {
  const query: Record<string, string | null> = {};

  if (choice.view !== undefined) {
    query[HERO_STATS_VIEW_PARAM] = choice.view === DEFAULT_HERO_STATS_VIEW ? null : choice.view;
  }

  if ('season' in choice) {
    query[HERO_STATS_SEASON_PARAM] = choice.season === undefined ? null : String(choice.season);
  }

  if (choice.mode !== undefined) {
    query[HERO_STATS_MODE_PARAM] = choice.mode === DEFAULT_MODE_ID ? null : choice.mode;
  }

  return query;
}
