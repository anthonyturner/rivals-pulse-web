/**
 * The data jobs an administrator can run on demand, and what the server tells the admin page about
 * them. The list is the allow-list: the server and the database accept these keys and nothing else,
 * and the key of a rebuild is the name of its `pg_cron` job, so the scheduled run is found by it.
 */

export type DataJobKind = 'rebuild' | 'sync';

/** A part of a public page that shows what a job refreshes, as a visitor finds it. */
export interface DataJobPage {
  /** The page's name, as the site's own navigation calls it. */
  name: string;
  /** Its address on the site; the admin page links to it. */
  path: string;
  /** The heading, or the plain description, of the part of the page that changes. */
  section: string;
}

export interface DataJobDefinition {
  key: string;
  label: string;
  kind: DataJobKind;
  /** One line on what the job does, for the page. */
  summary: string;
  /** In plain words, the numbers or content the job refreshes. */
  updates: string;
  /** Every place on the site that shows them. Empty when no page does. */
  pages: readonly DataJobPage[];
  /** The Pulse Atlas files (the public data feed) built from them. Empty when none is. */
  atlasFiles: readonly string[];
  /**
   * What can keep a run from showing, or why nothing shows it: the rule that hides a number, or
   * the statement that no page or file reads this job's output yet. Null when neither applies.
   */
  caveat: string | null;
  /** One real item that changes after a run, worded so it stays true whenever the job runs. */
  example: string;
}

export const DATA_JOBS = [
  {
    key: 'recompute-hero-aggregates',
    label: 'Hero stats',
    kind: 'rebuild',
    summary: 'Rebuilds the anonymous win, pick, kill, death and assist counts per hero, and how each hero does against every other.',
    updates:
      "The counts behind each hero's win rate, pick rate, KDA and final hits, behind the tier list and the role averages, " +
      "and behind each hero's record against every other hero.",
    pages: [
      { name: 'Home', path: '/', section: 'The "Matches counted" figure under the buttons at the top' },
      { name: 'Win rates', path: '/win-rates', section: 'Heroes, highest win rate first' },
      { name: 'Tier list', path: '/tier-list', section: 'Marvel Rivals tier list (the tiers)' },
      { name: 'Counters', path: '/counters', section: 'Heroes that beat a hero, and Heroes a hero beats' },
      { name: 'Dive planner', path: '/dive-planner', section: 'Choose overlap, then assign jobs' },
      {
        name: 'Heroes (any hero)',
        path: '/heroes',
        section: 'A hero in matches recorded by RivalsPulse players, and A hero against other heroes',
      },
      { name: 'Community, Heroes tab', path: '/community/heroes', section: 'Hero pick and win rates' },
      { name: 'Community, Tier list tab', path: '/community/tier-list', section: 'Community tier list' },
      { name: 'Community, Stats tab', path: '/community/stats', section: 'Community role benchmarks' },
      { name: 'Community, Counters tab', path: '/community/counters', section: 'Counter matchups' },
    ],
    atlasFiles: ['hero-stats.json', 'tier-list.json', 'community-stats.json'],
    caveat:
      'A hero gets a win rate and a tier after 10 appearances, a matchup appears after 10 recorded matches, and a role ' +
      'average after 50 appearances. Until the current half-season has a hero with 10 appearances, the pages show the ' +
      'previous half-season. Quick Match and Competitive are counted together unless a page lets you pick a mode.',
    example:
      'The "Matches counted" figure at the top of the home page goes up if new Quick Match or Competitive matches with a ' +
      'result have come in, unless the page is still showing the previous half-season.',
  },
  {
    key: 'recompute-extended-aggregates',
    label: 'Hero figures and kill feed',
    kind: 'rebuild',
    summary: 'Rebuilds damage, healing, blocked and time-played figures, the kill feed and ability counts.',
    updates:
      "The counts behind each hero's damage, healing and damage blocked per minute, the kill feed (which heroes a hero " +
      'is seen killing), and how often abilities and ultimates are used. The figures and the ability counts also feed the ' +
      '1 to 10 build scores.',
    pages: [
      {
        name: 'Community, Heroes tab',
        path: '/community/heroes',
        section: 'Community hero damage, healing and damage blocked',
      },
      {
        name: 'Community, Stats tab',
        path: '/community/stats',
        section: 'Damage, healing and damage blocked per minute',
      },
      {
        name: 'Community, Counters tab',
        path: '/community/counters',
        section: 'Community kill feed: most seen kills',
      },
      {
        name: 'Heroes (any hero)',
        path: '/heroes',
        section: 'A hero in the kill feed, and the Damage, Sustain, Ultimate and Utility scores in the closed Build Signals panel',
      },
      {
        name: 'Team builder',
        path: '/team-builder',
        section: "Build signals, and the scores on each chosen hero's card",
      },
    ],
    atlasFiles: ['hero-scores.json'],
    caveat:
      "A figure or kill pair shows only after 10 or more lines (a player's figures on a hero in one match; for the kill feed, " +
      'matches that showed the pair) from at least 3 different players, none above half. A role also needs 50 lines, and a ' +
      'build score needs 5 heroes that pass ("Waiting for more heroes" until then). Until then the sections say "Not enough ' +
      'data yet" or "Collecting data", so a run can leave every page as it was.',
    example:
      'Once a role has 50 lines that pass the rule, its figure replaces "Not enough data" in its row under "Damage, healing and damage ' +
      'blocked per minute" on the Community Stats tab. Until then a run changes nothing you can see.',
  },
  {
    key: 'recompute-community-match-aggregates',
    label: 'Community matches',
    kind: 'rebuild',
    summary: 'Rebuilds the match counts by map, mode and day.',
    updates: 'The counts of community matches by map, game mode and day.',
    pages: [],
    atlasFiles: [],
    caveat:
      'Nothing shows these counts yet: no page or public file reads them. The "My matches" tab on Community now shows each ' +
      "signed-in player's own matches, read from that player's own uploads, so this job does not change it.",
    example: 'None yet. A run changes stored counts that no page shows.',
  },
  {
    key: 'recompute-play-time-aggregates',
    label: 'Play time',
    kind: 'rebuild',
    summary: 'Rebuilds the when-and-how-long-people-play counts.',
    updates: 'The counts of when people play: by day of the week, time of day and place in a play session (all UTC).',
    pages: [],
    atlasFiles: [],
    caveat:
      'Nothing shows these counts yet: no page or public file reads them. The "My insights" tab on Community now shows each ' +
      "signed-in player's own play times, read from that player's own uploads, so this job does not change it.",
    example: 'None yet. A run changes stored counts that no page shows.',
  },
  {
    key: 'recompute-hero-pair-aggregates',
    label: 'Hero pairs',
    kind: 'rebuild',
    summary: 'Rebuilds the counts of heroes against and with each other.',
    updates: 'How often two heroes met on opposite teams and how often they played on the same team, with the wins behind each.',
    pages: [],
    atlasFiles: ['community-stats.json'],
    caveat:
      'No page on the site shows hero pairs yet. They reach only the public Pulse Atlas file, which changes at its next ' +
      'publish (every six hours). A pair is counted after 10 matches with a result.',
    example:
      'After the next Pulse Atlas publish, the "matches" and "wins" of a pair in community-stats.json change if new matches ' +
      'with a result featured a pair that already has 10.',
  },
  {
    key: 'home-news',
    label: 'Home news',
    kind: 'sync',
    summary: 'Reads the official Marvel Rivals site and replaces the home page news. A failed read keeps the earlier news.',
    updates:
      'The news, season status, newest hero and events on the home page, copied from the official Marvel Rivals site, ' +
      'and the video behind the top of the page when the latest season update has one.',
    pages: [{ name: 'Home', path: '/', section: "What's new in the game" }],
    atlasFiles: [],
    caveat:
      'A block hides itself when the official site gives it nothing. "Events and rewards" is hidden while the latest patch ' +
      'notes list no events.',
    example:
      'If the official site has posted something new since the last run, it appears first under "Latest news and patch ' +
      'notes" in "What\'s new in the game".',
  },
  {
    key: 'game-stats',
    label: 'Game stats',
    kind: 'sync',
    summary: 'Reads the Steam player counts and stores them as this hour\'s capture.',
    updates:
      "This hour's saved capture of the Steam player counts for Marvel Rivals and four other games. " +
      'The page measures its changes from the capture before the current hour.',
    pages: [{ name: 'Game stats', path: '/game-stats', section: 'Where Marvel Rivals sits in the pack' }],
    atlasFiles: [],
    caveat:
      '"Players now" comes from Steam and the page\'s answer is cached for up to 5 minutes, so this job does not change it, ' +
      'and nothing on the page changes during the hour of the run. The hour keeps its first capture, which a visit to the ' +
      'page can also take. If Steam does not answer for a game, a built-in number is stored for it; it becomes the next ' +
      'hour\'s starting point, and it shows as "Players now" if the page\'s own Steam read fails too. The page does not mark it.',
    example:
      'From the next hour, "Compared with" under the page title shows this hour\'s capture time, and the up or down changes ' +
      'under "Players now" are measured from it.',
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
