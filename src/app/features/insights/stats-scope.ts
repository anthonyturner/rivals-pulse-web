import type { HeroStatsMode, HeroStatsModeId } from '../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../shared/utilities/play-modes';

/**
 * The query values that pick a half-season and a mode on the hero-stats family of endpoints. The
 * default blend is asked for with no `mode`, so it shares the default request's cached answer.
 */
export function statsQueryParams(halfSeason?: number, mode?: HeroStatsModeId): Record<string, number | string> {
  return {
    ...(halfSeason === undefined ? {} : { halfSeason }),
    ...(mode === undefined || mode === DEFAULT_MODE_ID ? {} : { mode }),
  };
}

/**
 * Whether the half-season list and the mode list of an answer are readable. Both are absent in an
 * answer the CDN cached before they existed, so only a present one is checked.
 */
export function hasReadableScope(answer: { halfSeasons?: unknown; modes?: unknown }): boolean {
  return (
    (answer.halfSeasons === undefined ||
      (Array.isArray(answer.halfSeasons) && answer.halfSeasons.every(isHalfSeason))) &&
    (answer.modes === undefined || (Array.isArray(answer.modes) && answer.modes.every(isMode)))
  );
}

function isHalfSeason(value: unknown): boolean {
  const season = value as Record<string, unknown> | null;

  return (
    typeof season === 'object' &&
    season !== null &&
    typeof season['id'] === 'number' &&
    Number.isFinite(season['id']) &&
    typeof season['label'] === 'string'
  );
}

function isMode(value: unknown): boolean {
  const mode = value as Partial<Record<keyof HeroStatsMode, unknown>> | null;

  return (
    typeof mode === 'object' &&
    mode !== null &&
    typeof mode.id === 'string' &&
    typeof mode.label === 'string' &&
    typeof mode.decidedMatches === 'number' &&
    Number.isFinite(mode.decidedMatches)
  );
}
