import type {
  OwnActivity,
  OwnActivityRow,
  OwnDashboardResponse,
  OwnDashboardStats,
  OwnKda,
  OwnRecentMatch,
} from './own-dashboard.types';

const KDA: OwnKda = {
  matches: 18,
  kills: 270,
  deaths: 108,
  assists: 162,
  killsPerMatch: 15,
  deathsPerMatch: 6,
  assistsPerMatch: 9,
  ratio: 4,
};

/** One activity row of 4 matches won 3 to 1. */
export function activityRow(label: string): OwnActivityRow {
  return { label, matches: 4, wins: 3, losses: 1, winRate: 0.75 };
}

/** An account's activity tables, one row each, with `map` naming the only map so two accounts differ. */
export function activityOf(map: string): OwnActivity {
  return {
    maps: [activityRow(map)],
    modes: [activityRow('Quick Match')],
    days: [activityRow('2026-10-29')],
    weekdays: [activityRow('Thursday')],
    timesOfDay: [activityRow('08:00 to 11:59')],
    sessionPlaces: [activityRow('Match 1')],
  };
}

export function recentMatch(overrides: Partial<OwnRecentMatch> = {}): OwnRecentMatch {
  return {
    playedAt: '2026-10-30T18:20:00Z',
    hero: 'storm',
    result: 'win',
    kills: 12,
    deaths: 4,
    assists: 9,
    finalHits: 7,
    playModeId: 1,
    mapName: 'Tokyo 2099',
    ...overrides,
  };
}

/** A player with 20 matches: 2 without a result, 18 with kills, deaths and assists, 12 with final hits. */
export function dashboardStats(overrides: Partial<OwnDashboardStats> = {}): OwnDashboardStats {
  return {
    matches: 20,
    wins: 10,
    losses: 8,
    unknownResults: 2,
    winRate: 10 / 18,
    kda: KDA,
    finalHits: { matches: 12, total: 96, perMatch: 8 },
    topHeroes: [
      { hero: 'storm', matches: 9, wins: 6, losses: 3, winRate: 6 / 9, kda: KDA },
      { hero: 'hela', matches: 5, wins: 2, losses: 3, winRate: 0.4, kda: null },
    ],
    perMinute: {
      damage: { perMinute: 1234.5, samples: 14 },
      healing: null,
      blocked: { perMinute: 310, samples: 3 },
    },
    records: {
      mostKills: { value: 31, playedAt: '2026-10-12T20:00:00Z', hero: 'hela' },
      mostAssists: null,
      mostFinalHits: { value: 19, playedAt: '2026-10-20T20:00:00Z', hero: null },
      longestWinStreak: 4,
    },
    recent: [
      recentMatch(),
      recentMatch({
        playedAt: '2026-10-29T12:00:00Z',
        hero: 'hela',
        result: 'loss',
        finalHits: null,
        playModeId: 0,
        mapName: null,
      }),
      recentMatch({
        playedAt: '2026-10-28T12:00:00Z',
        hero: null,
        result: null,
        kills: null,
        deaths: null,
        assists: null,
        finalHits: null,
        playModeId: null,
        mapName: null,
      }),
    ],
    firstPlayedAt: '2026-05-20T12:00:00Z',
    lastPlayedAt: '2026-10-30T18:20:00Z',
    activity: { maps: [], modes: [], days: [], weekdays: [], timesOfDay: [], sessionPlaces: [] },
    ...overrides,
  };
}

export function linkedDashboard(
  overrides: Partial<OwnDashboardStats> = {},
  truncated = false,
): Extract<OwnDashboardResponse, { linked: true }> {
  return {
    linked: true,
    player: { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
    truncated,
    stats: dashboardStats(overrides),
  };
}

/** A linked player whose app has uploaded no match yet. */
export function emptyDashboard(): Extract<OwnDashboardResponse, { linked: true }> {
  return linkedDashboard({
    matches: 0,
    wins: 0,
    losses: 0,
    unknownResults: 0,
    winRate: null,
    kda: null,
    finalHits: null,
    topHeroes: [],
    perMinute: { damage: null, healing: null, blocked: null },
    records: { mostKills: null, mostAssists: null, mostFinalHits: null, longestWinStreak: 0 },
    recent: [],
    firstPlayedAt: null,
    lastPlayedAt: null,
    activity: { maps: [], modes: [], days: [], weekdays: [], timesOfDay: [], sessionPlaces: [] },
  });
}
