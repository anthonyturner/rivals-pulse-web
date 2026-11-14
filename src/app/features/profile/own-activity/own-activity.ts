import type { OwnActivity, OwnActivityRow } from '../../../core/auth/own-dashboard.types';
import { dayLabel } from '../../../shared/utilities/day-label';

export interface OwnActivityRowView {
  label: string;
  matches: number;
  winRate: string;
  /** The win rate, 0 to 100, as the width of its bar. */
  barPercent: number;
}

export interface OwnActivityTableView {
  title: string;
  rowHeading: string;
  rows: OwnActivityRowView[];
}

export function ownActivityRows(rows: readonly OwnActivityRow[]): OwnActivityRowView[] {
  return rows.map((row) => ({
    label: row.label,
    matches: row.matches,
    winRate: row.winRate === null ? 'No results' : `${Math.round(row.winRate * 100)}%`,
    barPercent: row.winRate === null ? 0 : row.winRate * 100,
  }));
}

/** My matches: where and in which mode the account played, and on which days. */
export function ownMatchTables({ maps, modes, days }: OwnActivity): OwnActivityTableView[] {
  return [
    { title: 'Win rate by map', rowHeading: 'Map', rows: ownActivityRows(maps) },
    { title: 'Game modes played', rowHeading: 'Mode', rows: ownActivityRows(modes) },
    {
      title: 'Your last 30 days played',
      rowHeading: 'Day',
      rows: ownActivityRows(days).map((row) => ({ ...row, label: dayLabel(row.label) })),
    },
  ];
}

/** My insights: when the account plays and wins. */
export function ownInsightTables({ weekdays, timesOfDay, sessionPlaces }: OwnActivity): OwnActivityTableView[] {
  return [
    { title: 'Day of the week', rowHeading: 'Day', rows: ownActivityRows(weekdays) },
    { title: 'Time of day', rowHeading: 'Time', rows: ownActivityRows(timesOfDay) },
    { title: 'Place in a play session', rowHeading: 'Place', rows: ownActivityRows(sessionPlaces) },
  ];
}
