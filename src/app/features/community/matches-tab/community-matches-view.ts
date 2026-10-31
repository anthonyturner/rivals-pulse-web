import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';

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
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      sample: string;
      maps: CommunitySectionView<CommunityMapRowView> & {
        /** Maps with a result but under the minimum: only their names. */
        pending: string[];
      };
      modeMix: CommunitySectionView<CommunityModeRowView>;
      averageLength: { label: string | null; note: string | null };
      perDay: CommunitySectionView<CommunityDayRowView>;
    };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  const { overviewMatches, mapMatches, lengthMatches, recorders } = data.minimums;
  const fromPlayers = `from at least ${recorders} players`;
  const halfSeasonLabel = data.halfSeason?.label ?? null;

  if (data.status === 'not-enough-data') {
    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      summary: `${halfSeasonLabel ? `${halfSeasonLabel} does not have enough data yet.` : 'No matches are counted yet.'} The first figures appear at ${overviewMatches} matches ${fromPlayers}.`,
    };
  }

  const busiestDay = Math.max(1, ...(data.perDay ?? []).map((day) => day.share));
  const season = halfSeasonLabel ?? 'this half-season';

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: data.inPlaceOf ? halfSeasonFallbackNotice(data.inPlaceOf.label, halfSeasonLabel) : null,
    sample: `${data.matchesBand === null ? 'Matches' : `${data.matchesBand}+ matches`} in ${season}, each counted once however many players recorded it.`,
    maps: {
      rows: data.maps.map((record) => ({
        map: record.map,
        winRateLabel: percentLabel(record.winRate),
        barPercent: record.winRate,
      })),
      pending: data.mapsBelowMinimum,
      note:
        data.maps.length === 0
          ? `Not enough data yet. A map needs ${mapMatches} matches with a result ${fromPlayers} before its win rate shows.`
          : null,
    },
    modeMix: {
      rows: (data.modeMix ?? []).map((share) => ({
        mode: share.mode,
        shareLabel: percentLabel(share.share),
        lengthLabel: share.averageLengthMinutes === null ? null : minutesLabel(share.averageLengthMinutes),
        barPercent: share.share,
      })),
      note: data.modeMix === null ? `Not enough data yet. The mix appears at ${overviewMatches} matches ${fromPlayers}.` : null,
    },
    averageLength:
      data.averageLengthMinutes === null
        ? {
            label: null,
            note: `Not enough data yet. An average needs ${lengthMatches} matches with a known length ${fromPlayers}.`,
          }
        : { label: minutesLabel(data.averageLengthMinutes), note: null },
    perDay: {
      rows: (data.perDay ?? []).map((day) => ({
        day: dayLabel(day.day),
        shareLabel: percentLabel(day.share),
        barPercent: (day.share / busiestDay) * 100,
      })),
      note: data.perDay === null ? `Not enough data yet. Days appear at ${overviewMatches} matches ${fromPlayers}.` : null,
    },
  };
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

/** A UTC calendar day such as `2026-10-29` as `Thu 29 Oct`; anything else is shown as it came. */
export function dayLabel(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);

  if (match === null) {
    return day;
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}
