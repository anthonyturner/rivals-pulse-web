import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { dayLabel } from '../../../shared/utilities/day-label';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { COMMUNITY_EMPTY_RULE } from '../community-summary/community-summary.component';

export interface CommunityMapRowView {
  map: string;
  winRateLabel: string;
  /** The win rate, 0 to 100, as the width of its bar. */
  barPercent: number;
}

export interface CommunityModeRowView {
  mode: string;
  shareLabel: string;
  /** Null when too few of the mode's matches carried a length. */
  lengthLabel: string | null;
  barPercent: number;
}

export interface CommunityDayRowView {
  day: string;
  shareLabel: string;
  /** This day's share against the busiest day's, 0 to 100. */
  barPercent: number;
}

/** A section of rows, or the sentence that says why it has none yet. Never both blank. */
export interface CommunitySectionView<Row> {
  rows: Row[];
  note: string | null;
}

export type CommunityMatchesView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; halfSeasonLabel: string | null; summary: string }
  | CommunityMatchesReady;

export interface CommunityMatchesReady {
  kind: 'ready';
  halfSeasonLabel: string | null;
  /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
  notice: string | null;
  sample: string;
  maps: {
    /** The maps players win on most, best first. */
    best: CommunityMapRowView[];
    /** The maps players lose on most, worst first; never a map that is in `best`. */
    worst: CommunityMapRowView[];
    /** Why there is no map to show yet; null once there is one. */
    note: string | null;
    /** The maps with a result but under the minimum, as one sentence of names; null when every one is shown. */
    pendingNote: string | null;
  };
  modeMix: CommunitySectionView<CommunityModeRowView>;
  averageLength: { label: string | null; note: string | null };
  perDay: CommunitySectionView<CommunityDayRowView>;
  /** The matches a day lately, for the pace of the overview's heartbeat; null when no day is listed. */
  recentMatchesPerDay: number | null;
}

/**
 * What the Matches tab shows. `undefined` means the answer has not arrived and `null` that it could
 * not be read; neither is "not enough data", which is a real answer. The answer carries no exact
 * count, so no label here can show one.
 */
export function buildCommunityMatchesView(data: CommunityMatches | null | undefined): CommunityMatchesView {
  if (data === undefined) {
    return { kind: 'loading' };
  }

  if (data === null) {
    return { kind: 'unavailable' };
  }

  const { overviewMatches, mapMatches, lengthMatches } = data.minimums;
  const halfSeasonLabel = data.halfSeason?.label ?? null;

  if (data.status === 'not-enough-data') {
    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      summary: `${halfSeasonLabel ? `${halfSeasonLabel} does not have enough data yet.` : 'No matches are counted yet.'} ${COMMUNITY_EMPTY_RULE}`,
    };
  }

  const busiestDay = Math.max(1, ...(data.perDay ?? []).map((day) => day.share));
  const season = halfSeasonLabel ?? 'this half-season';

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: data.inPlaceOf ? halfSeasonFallbackNotice(data.inPlaceOf.label, halfSeasonLabel) : null,
    sample: `${data.matchesCounted === null ? 'Matches' : countLabel(data.matchesCounted, 'match', 'matches')} in ${season}, each counted once however many players recorded it. While few players upload, these totals can come from one player.`,
    maps: {
      ...bestAndWorstMaps(data.maps),
      pendingNote:
        data.mapsBelowMinimum.length === 0 ? null : `Not enough data yet for: ${data.mapsBelowMinimum.join(', ')}.`,
      note:
        data.maps.length === 0
          ? `Not enough data yet. A map needs ${mapMatches} matches in one game mode and ${mapMatches} with a result before its win rate shows.`
          : null,
    },
    modeMix: {
      rows: (data.modeMix ?? []).map((share) => ({
        mode: share.mode,
        shareLabel: percentLabel(share.share),
        lengthLabel: share.averageLengthMinutes === null ? null : minutesLabel(share.averageLengthMinutes),
        barPercent: share.share,
      })),
      note:
        data.modeMix === null || data.modeMix.length === 0
          ? `Not enough data yet. The mix appears at ${overviewMatches} matches.`
          : null,
    },
    averageLength:
      data.averageLengthMinutes === null
        ? {
            label: null,
            note: `Not enough data yet. An average needs ${lengthMatches} matches with a known length.`,
          }
        : { label: minutesLabel(data.averageLengthMinutes), note: null },
    perDay: {
      rows: (data.perDay ?? []).map((day) => ({
        day: dayLabel(day.day),
        shareLabel: percentLabel(day.share),
        barPercent: (day.share / busiestDay) * 100,
      })),
      note:
        data.perDay === null || data.perDay.length === 0
          ? `Not enough data yet. A day is listed once it has ${overviewMatches} matches.`
          : null,
    },
    recentMatchesPerDay: recentMatchesPerDay(data),
  };
}

const TEASER_MAPS = 3;
/** The latest day is still filling up, so the pace is read from the full days before it. */
const RECENT_DAYS = 3;

/** The top and bottom of the maps by win rate. A map is in one list at most: a short list is split, the better half first. */
function bestAndWorstMaps(maps: CommunityMatches['maps']): Pick<CommunityMatchesReady['maps'], 'best' | 'worst'> {
  const ranked = maps
    .map((record) => ({ map: record.map, winRateLabel: percentLabel(record.winRate), barPercent: record.winRate }))
    .sort((a, b) => b.barPercent - a.barPercent);
  const best = ranked.slice(0, Math.min(TEASER_MAPS, Math.ceil(ranked.length / 2)));

  return { best, worst: ranked.slice(best.length).slice(-TEASER_MAPS).reverse() };
}

/**
 * About how many matches players upload a day lately: the busiest recent days' average share of the
 * season's matches. Only the shares and the matches counted are read, so it is a rough pace, which is
 * all a heartbeat needs. Null when the answer lists no day or counts no matches.
 */
export function recentMatchesPerDay(data: CommunityMatches): number | null {
  const days = data.perDay ?? [];
  const fullDays = days.length > RECENT_DAYS ? days.slice(-RECENT_DAYS - 1, -1) : days;

  if (data.matchesCounted === null || fullDays.length === 0) {
    return null;
  }

  const share = fullDays.reduce((sum, day) => sum + day.share, 0) / fullDays.length;

  return (data.matchesCounted * share) / 100;
}

/** A whole percentage, such as `58%`. */
function percentLabel(value: number): string {
  return `${value}%`;
}

/** Whole minutes as `12 min` or `1 h 5 min`. */
export function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${rest} min`;
  }

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
