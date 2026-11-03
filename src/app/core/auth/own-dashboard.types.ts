import type { LinkedPlayer } from './linked-player.types.js';

/**
 * What `GET /api/account/dashboard` answers. The server reads this file too (`src/server/account/own-dashboard.ts`),
 * so it imports only a sibling type: the browser and the API must agree on it.
 *
 * A figure that was not recorded is `null`, never 0. A count of nothing (`matches: 0`) is a real 0.
 */
export type OwnDashboardResponse =
  /** The account has no link to an in-game player. */
  | { linked: false }
  | {
      linked: true;
      player: LinkedPlayer;
      /** True when more lines existed than were read, so the figures cover only the newest ones. */
      truncated: boolean;
      stats: OwnDashboardStats;
    };

export interface OwnDashboardStats {
  /** Every match read. Includes matches whose result or figures are unknown. */
  matches: number;
  wins: number;
  losses: number;
  /** Matches with no recorded result; they count in `matches` and in neither of the two above. */
  unknownResults: number;
  /** wins / (wins + losses), from 0 to 1; null when no match has a known result. */
  winRate: number | null;
  /** Over the matches that recorded kills, deaths and assists together; null when none did. */
  kda: OwnKda | null;
  /** Over the matches that counted final hits; null when none did. */
  finalHits: OwnFinalHits | null;
  /** Up to five, most played first. A hero this site does not know yet is left out. */
  topHeroes: OwnHeroSummary[];
  perMinute: OwnPerMinute;
  records: OwnRecords;
  /** Newest first. */
  recent: OwnRecentMatch[];
  /** ISO times of the oldest and newest match read; null when there are none. */
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
}

export interface OwnKda {
  /** How many matches the totals cover. */
  matches: number;
  kills: number;
  deaths: number;
  assists: number;
  killsPerMatch: number;
  deathsPerMatch: number;
  assistsPerMatch: number;
  /** (kills + assists) / deaths; with no deaths it is kills + assists. */
  ratio: number;
}

export interface OwnFinalHits {
  matches: number;
  total: number;
  perMatch: number;
}

export interface OwnHeroSummary {
  /** The hero's id in `heroes.json`. */
  hero: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kda: OwnKda | null;
}

/** A rate per minute of play, and how many hero-match figures it rests on. */
export interface OwnRate {
  perMinute: number;
  /** Hero-match figure lines behind the rate; the page decides how few is too few. */
  samples: number;
}

export interface OwnPerMinute {
  damage: OwnRate | null;
  healing: OwnRate | null;
  blocked: OwnRate | null;
}

export interface OwnRecord {
  value: number;
  playedAt: string;
  /** The hero played in that match, or null when the site does not know it. */
  hero: string | null;
}

export interface OwnRecords {
  mostKills: OwnRecord | null;
  mostAssists: OwnRecord | null;
  mostFinalHits: OwnRecord | null;
  /** Wins in a row, oldest to newest. A match with no recorded result ends a streak. */
  longestWinStreak: number;
}

export interface OwnRecentMatch {
  playedAt: string;
  hero: string | null;
  result: 'win' | 'loss' | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  finalHits: number | null;
  /** 0 Quick Match, 1 Competitive, 2 Arcade, 3 Practice; null when the game did not say. */
  playModeId: number | null;
  mapName: string | null;
}
