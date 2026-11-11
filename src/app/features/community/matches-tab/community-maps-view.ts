import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { COMMUNITY_EMPTY_RULE } from '../community-summary/community-summary.component';

export interface CommunityMapRowView {
  map: string;
  winRateLabel: string;
  /** The win rate, 0 to 100, as the width of its bar. */
  barPercent: number;
}

/**
 * What the maps in a Community Matches answer look like on the page. The Overview's short list and the
 * Maps tab's full one both read this, so the two can never rank a map differently.
 */
export interface CommunityMapsView {
  /** Every map with a rate, best first. */
  all: CommunityMapRowView[];
  /** The maps players win on most, best first. */
  best: CommunityMapRowView[];
  /** The maps players lose on most, worst first; never a map that is in `best`. */
  worst: CommunityMapRowView[];
  /** The link to the full list, such as `All 17 maps`; null while no map has a rate. */
  allLabel: string | null;
  /** Why there is no map to show yet; null once there is one. */
  note: string | null;
  /** The names of the maps still waiting for a rate, as one line; null when every known map is shown. */
  waitingNote: string | null;
}

/** What the Maps tab shows: the shared frame's states, then the maps. */
export type CommunityMapsPageView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; halfSeasonLabel: string | null; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      maps: CommunityMapsView;
    };

const TEASER_MAPS = 3;

/** The top and bottom of the maps by win rate, and every map in order. A map is in `best` or `worst`, never both: a short list is split, the better half first. */
export function buildMapsView(data: CommunityMatches): CommunityMapsView {
  const all = data.maps
    .map((record): CommunityMapRowView => ({
      map: record.map,
      winRateLabel: `${record.winRate}%`,
      barPercent: record.winRate,
    }))
    .sort((a, b) => b.barPercent - a.barPercent);
  const best = all.slice(0, Math.min(TEASER_MAPS, Math.ceil(all.length / 2)));

  return {
    all,
    best,
    worst: all.slice(best.length).slice(-TEASER_MAPS).reverse(),
    allLabel: all.length === 0 ? null : `All ${countLabel(all.length, 'map', 'maps')}`,
    note:
      all.length === 0
        ? `Not enough data yet. A map needs ${data.minimums.mapMatches} matches in one game mode and ${data.minimums.mapMatches} with a result before its win rate shows.`
        : null,
    waitingNote: data.mapsBelowMinimum.length === 0 ? null : `${data.mapsBelowMinimum.join(', ')}.`,
  };
}

/**
 * What the Maps tab shows. `undefined` means the answer has not arrived and `null` that it could not
 * be read; neither is "not enough data", which is a real answer that stays thin until one map has a rate.
 */
export function buildCommunityMapsPageView(data: CommunityMatches | null | undefined): CommunityMapsPageView {
  if (data === undefined) {
    return { kind: 'loading' };
  }

  if (data === null) {
    return { kind: 'unavailable' };
  }

  const halfSeasonLabel = data.halfSeason?.label ?? null;
  const maps = buildMapsView(data);

  if (maps.all.length === 0) {
    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      summary: `${halfSeasonLabel ? `${halfSeasonLabel} has no map with a win rate yet.` : 'No matches are counted yet.'} ${maps.note ?? COMMUNITY_EMPTY_RULE}`,
    };
  }

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: data.inPlaceOf ? halfSeasonFallbackNotice(data.inPlaceOf.label, halfSeasonLabel) : null,
    maps,
  };
}
