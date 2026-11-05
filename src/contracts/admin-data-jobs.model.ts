/**
 * The data jobs an administrator can run on demand, and what the server tells the admin page about
 * them. The list is the allow-list: the server and the database accept these keys and nothing else,
 * and the key of a rebuild is the name of its `pg_cron` job, so the scheduled run is found by it.
 */

export type DataJobKind = 'rebuild' | 'sync';

export interface DataJobDefinition {
  key: string;
  label: string;
  kind: DataJobKind;
  /** One line on what the job does, for the page. */
  summary: string;
}

export const DATA_JOBS = [
  {
    key: 'recompute-hero-aggregates',
    label: 'Hero stats',
    kind: 'rebuild',
    summary: 'Rebuilds the anonymous win, pick and kill counts per hero.',
  },
  {
    key: 'recompute-extended-aggregates',
    label: 'Hero figures and kill feed',
    kind: 'rebuild',
    summary: 'Rebuilds damage, healing, blocked and time-played figures, the kill feed and ability counts.',
  },
  {
    key: 'recompute-community-match-aggregates',
    label: 'Community matches',
    kind: 'rebuild',
    summary: 'Rebuilds the match counts by map, mode and day.',
  },
  {
    key: 'recompute-play-time-aggregates',
    label: 'Play time',
    kind: 'rebuild',
    summary: 'Rebuilds the when-and-how-long-people-play counts.',
  },
  {
    key: 'recompute-hero-pair-aggregates',
    label: 'Hero pairs',
    kind: 'rebuild',
    summary: 'Rebuilds the counts of heroes against and with each other.',
  },
  {
    key: 'home-news',
    label: 'Home news',
    kind: 'sync',
    summary: 'Reads the official Marvel Rivals site and replaces the home page news. A failed read keeps the earlier news.',
  },
  {
    key: 'game-stats',
    label: 'Game stats',
    kind: 'sync',
    summary: 'Reads the Steam player counts and stores them as this hour\'s capture.',
  },
] as const satisfies readonly DataJobDefinition[];

export type DataJobKey = (typeof DATA_JOBS)[number]['key'];

export function isDataJobKey(value: unknown): value is DataJobKey {
  return DATA_JOBS.some((job) => job.key === value);
}

/** What a game stats capture came to. Only the first stores numbers that all came from Steam. */
export type GameStatsOutcome =
  | { result: 'stored'; capturedAt: string; games: number }
  /** Steam did not answer for some games, so their built-in numbers were stored and the hour keeps them. */
  | { result: 'stored-with-fallbacks'; capturedAt: string; games: number; fallbackGames: number }
  /** The hour already had a capture, so nothing was stored. `capturedAt` is when that one was made. */
  | { result: 'already-captured'; capturedAt: string; games: number; fallbackGames: number };

/** What a run came to, as the page words it. A failed run carries only a message. */
export type DataJobDetail =
  | { result: 'rebuilt'; halfSeasons: number }
  | { result: 'news-synced'; cards: number }
  | GameStatsOutcome
  | { result: 'failed'; message: string };

/**
 * `unfinished` is a run the database still lists as running after the time limit: its server
 * stopped before it could say how it ended.
 */
export type DataJobOutcome = 'succeeded' | 'failed' | 'running' | 'unfinished';

export interface DataJobRun {
  outcome: DataJobOutcome;
  startedAt: string;
  finishedAt: string | null;
  /** What the run came to, when it was an administrator's run and finished. */
  detail: DataJobDetail | null;
  /** The scheduler's own words, for a scheduled run that did not succeed. */
  message: string | null;
}

/** Why a job cannot start now: it is running, or it ran too recently. */
export interface DataJobWait {
  reason: 'running' | 'cooldown';
  retryAt: string;
}

export interface DataJobStatus {
  job: DataJobKey;
  lastScheduled: DataJobRun | null;
  lastManual: DataJobRun | null;
  wait: DataJobWait | null;
}

export interface DataJobsAnswer {
  jobs: DataJobStatus[];
}

/** The answer to starting a job. The run happened and finished, well or badly; `recorded` says whether its audit row was closed. */
export interface DataJobRunAnswer {
  run: {
    job: DataJobKey;
    outcome: 'succeeded' | 'failed';
    detail: DataJobDetail;
    recorded: boolean;
  };
}

/** The answer when a job was not started. */
export interface DataJobBusyAnswer {
  error: string;
  reason: DataJobWait['reason'];
  retryAt: string;
}
