import type { OwnActivity, OwnActivityRow } from '../../app/core/auth/own-dashboard.types.ts';
import { PLAY_MODE_IDS, PLAY_MODE_NAMES } from '../../contracts/play-modes.ts';
import type { OwnDashboardLine } from './own-dashboard.ts';

/** Lines carry a start time but no length, so 30 idle minutes plus a typical match separate two sessions. */
const SESSION_GAP_MS = 45 * 60 * 1000;
const NEWEST_DAYS = 30;
const LAST_SESSION_PLACE = 4;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Label<Line> = (line: Line) => string | null;

/** When and where one player's matches were played and won. Every day and hour is UTC. */
export function deriveOwnActivity(lines: readonly OwnDashboardLine[]): OwnActivity {
  const oldestFirst = [...lines].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));
  const placed = withSessionPlaces(oldestFirst);
  // Practice and Arcade results would blur a win rate, so the mode table alone counts them.
  const ranked = placed.filter(
    ({ line }) => line.playModeId === PLAY_MODE_IDS.quickMatch || line.playModeId === PLAY_MODE_IDS.competitive,
  );

  return {
    maps: byMostPlayed(rowsOf(ranked, ({ line }) => line.mapName)),
    modes: byMostPlayed(rowsOf(placed, ({ line }) => PLAY_MODE_NAMES.get(line.playModeId ?? PLAY_MODE_IDS.unknown) ?? 'Other')),
    days: rowsOf(placed, ({ line }) => line.playedAt.slice(0, 10))
      .sort((a, b) => b.label.localeCompare(a.label))
      .slice(0, NEWEST_DAYS),
    weekdays: inOrder(rowsOf(ranked, ({ line }) => weekdayOf(line.playedAt)), WEEKDAYS),
    timesOfDay: inOrder(
      rowsOf(ranked, ({ line }) => blockLabel(Math.floor(new Date(line.playedAt).getUTCHours() / 4))),
      [0, 1, 2, 3, 4, 5].map(blockLabel),
    ),
    sessionPlaces: inOrder(
      rowsOf(ranked, ({ place }) => placeLabel(place)),
      [1, 2, 3, 4].map(placeLabel),
    ),
  };
}

function withSessionPlaces(oldestFirst: readonly OwnDashboardLine[]) {
  let place = 0;
  let previous = Number.NEGATIVE_INFINITY;

  return oldestFirst.map((line) => {
    const startedAt = Date.parse(line.playedAt);

    place = startedAt - previous > SESSION_GAP_MS ? 1 : place + 1;
    previous = startedAt;

    return { line, place };
  });
}

function rowsOf<Line extends { line: OwnDashboardLine }>(lines: readonly Line[], labelOf: Label<Line>): OwnActivityRow[] {
  const rows = new Map<string, OwnActivityRow>();

  for (const entry of lines) {
    const label = labelOf(entry);

    if (label !== null) {
      const row = rows.get(label) ?? { label, matches: 0, wins: 0, losses: 0, winRate: null };

      row.matches += 1;
      row.wins += entry.line.isWin === true ? 1 : 0;
      row.losses += entry.line.isWin === false ? 1 : 0;
      row.winRate = row.wins + row.losses > 0 ? row.wins / (row.wins + row.losses) : null;
      rows.set(label, row);
    }
  }

  return [...rows.values()];
}

function byMostPlayed(rows: OwnActivityRow[]): OwnActivityRow[] {
  return rows.sort((a, b) => b.matches - a.matches || a.label.localeCompare(b.label));
}

function inOrder(rows: readonly OwnActivityRow[], labels: readonly string[]): OwnActivityRow[] {
  return labels.flatMap((label) => rows.filter((row) => row.label === label));
}

function weekdayOf(playedAt: string): string {
  return WEEKDAYS[(new Date(playedAt).getUTCDay() + 6) % 7];
}

function blockLabel(block: number): string {
  const start = String(block * 4).padStart(2, '0');
  const end = String(block * 4 + 3).padStart(2, '0');

  return `${start}:00 to ${end}:59`;
}

function placeLabel(place: number): string {
  return place >= LAST_SESSION_PLACE ? `Match ${LAST_SESSION_PLACE} or later` : `Match ${place}`;
}
