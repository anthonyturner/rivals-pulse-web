import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';

export interface CommunityMapRowView {
  map: string;
  winRateLabel: string;
  recordLabel: string;
  /** The win rate, 0 to 100, as the width of its bar. */
  barPercent: number;
}

export interface CommunityModeRowView {
  mode: string;
  shareLabel: string;
  matchesLabel: string;
  /** Null when too few of the mode's matches carried a length. */
  lengthLabel: string | null;
  barPercent: number;
}

export interface CommunityDayRowView {
  day: string;
  matchesLabel: string;
  /** This day's matches against the busiest day's, 0 to 100. */
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
        /** Maps with a result but under the minimum, such as "Klyntar: 4 of 10 matches". */
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
 * not be read; neither is "not enough data", which is a real answer.
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
    const sofar =
      data.matchesCounted === 0
        ? `No matches are counted${halfSeasonLabel ? ` in ${halfSeasonLabel}` : ''} yet.`
        : `${halfSeasonLabel ?? 'This half-season'} has ${countLabel(data.matchesCounted, 'match', 'matches')} counted so far.`;

    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      summary: `${sofar} The first figures appear at ${overviewMatches} matches.`,
    };
  }

  const busiestDay = Math.max(1, ...(data.perDay ?? []).map((day) => day.matches));

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: data.inPlaceOf ? halfSeasonFallbackNotice(data.inPlaceOf.label, halfSeasonLabel) : null,
    sample: `${countLabel(data.matchesCounted, 'match', 'matches')} counted in ${halfSeasonLabel ?? 'this half-season'}, each once however many players recorded it.`,
    maps: {
      rows: data.maps.map((record) => ({
        map: record.map,
        winRateLabel: percentLabel(record.winRate),
        recordLabel: `${countLabel(record.wins, 'win', 'wins')} in ${countLabel(record.matches, 'match', 'matches')}`,
        barPercent: record.winRate,
      })),
      pending: data.mapsBelowMinimum.map((entry) => `${entry.map}: ${entry.matches} of ${mapMatches} matches`),
      note:
        data.maps.length === 0
          ? `Not enough data yet. A map needs ${mapMatches} matches with a result before its win rate shows.`
          : null,
    },
    modeMix: {
      rows: (data.modeMix ?? []).map((share) => ({
        mode: share.mode,
        shareLabel: percentLabel(share.share),
        matchesLabel: countLabel(share.matches, 'match', 'matches'),
        lengthLabel: share.averageLengthSeconds === null ? null : durationLabel(share.averageLengthSeconds),
        barPercent: share.share,
      })),
      note: data.modeMix === null ? `Not enough data yet. The mix appears at ${overviewMatches} matches.` : null,
    },
    averageLength:
      data.averageLengthSeconds === null
        ? {
            label: null,
            note: `Not enough data yet. An average needs ${lengthMatches} matches with a known length.`,
          }
        : { label: durationLabel(data.averageLengthSeconds), note: null },
    perDay: {
      rows: (data.perDay ?? []).map((day) => ({
        day: dayLabel(day.day),
        matchesLabel: countLabel(day.matches, 'match', 'matches'),
        barPercent: (day.matches / busiestDay) * 100,
      })),
      note: data.perDay === null ? `Not enough data yet. Days appear at ${overviewMatches} matches.` : null,
    },
  };
}

/** Seconds as `12 min 5 s`, `45 s` or `1 h 2 min`, rounded to the second. */
export function durationLabel(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  if (minutes > 0) {
    return rest > 0 ? `${minutes} min ${rest} s` : `${minutes} min`;
  }

  return `${rest} s`;
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
