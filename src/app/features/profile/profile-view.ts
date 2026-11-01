import type { DashboardResult } from '../../core/auth/auth.service';
import type { LinkedPlayer } from '../../core/auth/linked-player.types';
import type {
  OwnDashboardStats,
  OwnFinalHits,
  OwnHeroSummary,
  OwnKda,
  OwnRate,
  OwnRecentMatch,
  OwnRecord,
} from '../../core/auth/own-dashboard.types';
import { playModeName } from '../../shared/utilities/play-modes';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';
import type { CommunityHeroRow } from '../community/community-hero-list/community-hero-list.component';
import { heroCell, type HeroIdentities } from '../insights/hero-identity';

/** Shown in place of a figure the desktop app did not record. Never 0. */
export const NOT_COUNTED = 'Not counted';

/** Fewer hero-match figure lines than this make a per-minute rate a rough guide. */
export const MIN_RATE_SAMPLES = 5;

/** Where the stores' history stops, said wherever a person might read an empty or short page as a fault. */
export const DEPTH_NOTE =
  'History goes back about six months. A match first uploaded by another RivalsPulse user in your lobby, or uploaded before 9 October 2026, may be missing.';

const TRUNCATED_NOTE = 'You have more matches than we read, so these figures cover your newest ones only.';

/** One labelled figure. `counted` is false when the value is the "not counted" line. */
export interface ProfileFigure {
  label: string;
  value: string;
  detail: string | null;
  counted: boolean;
}

export interface ProfileRecentMatch {
  key: string;
  playedAt: string;
  hero: string;
  result: string;
  outcome: 'win' | 'loss' | 'unknown';
  kda: string;
  finalHits: string;
  where: string | null;
}

export type ProfileView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-linked' }
  | { kind: 'no-matches'; player: LinkedPlayer }
  | {
      kind: 'ready';
      player: LinkedPlayer;
      sample: string;
      /** Set when more matches existed than were read, so the figures cover only the newest. */
      notice: string | null;
      overview: ProfileFigure[];
      topHeroes: CommunityHeroRow[];
      perMinute: ProfileFigure[];
      records: ProfileFigure[];
      recent: ProfileRecentMatch[];
    };

/**
 * What the profile page shows. `undefined` means the answer has not arrived (or the hero names it
 * needs have not), so the page waits rather than drawing a hero under a guessed name. A signed-out
 * answer is the page's cue to send the visitor to sign in, so it reads as loading here.
 */
export function buildProfileView(
  result: DashboardResult | undefined,
  identities: HeroIdentities | undefined,
): ProfileView {
  if (result === undefined || result.status === 'signedOut') {
    return { kind: 'loading' };
  }

  if (result.status === 'unavailable') {
    return { kind: 'unavailable' };
  }

  const dashboard = result.dashboard;

  if (!dashboard.linked) {
    return { kind: 'not-linked' };
  }

  const { player, stats, truncated } = dashboard;

  if (stats.matches === 0) {
    return { kind: 'no-matches', player };
  }

  if (identities === undefined) {
    return { kind: 'loading' };
  }

  return {
    kind: 'ready',
    player,
    sample: sampleOf(stats),
    notice: truncated ? TRUNCATED_NOTE : null,
    overview: overviewOf(stats),
    topHeroes: stats.topHeroes.map((hero) => topHeroRow(hero, identities)),
    perMinute: [
      rateFigure('Damage per minute', stats.perMinute.damage),
      rateFigure('Healing per minute', stats.perMinute.healing),
      rateFigure('Blocked per minute', stats.perMinute.blocked),
    ],
    records: [
      recordFigure('Most kills', stats.records.mostKills, identities),
      recordFigure('Most assists', stats.records.mostAssists, identities),
      recordFigure('Most final hits', stats.records.mostFinalHits, identities),
      {
        label: 'Longest win streak',
        value: `${stats.records.longestWinStreak}`,
        detail: 'Wins in a row. A match with no recorded result ends a streak.',
        counted: true,
      },
    ],
    recent: stats.recent.map((match, index) => recentRow(match, index, identities)),
  };
}

function sampleOf(stats: OwnDashboardStats): string {
  const matches = countLabel(stats.matches, 'match', 'matches');
  const first = stats.firstPlayedAt === null ? null : dateLabel(stats.firstPlayedAt);
  const last = stats.lastPlayedAt === null ? null : dateLabel(stats.lastPlayedAt);

  if (first === null || last === null) {
    return matches;
  }

  return first === last ? `${matches}, played ${first}` : `${matches}, played between ${first} and ${last}`;
}

function overviewOf(stats: OwnDashboardStats): ProfileFigure[] {
  return [
    { label: 'Matches', value: `${stats.matches}`, detail: null, counted: true },
    winRateFigure(stats),
    kdaFigure(stats.kda),
    finalHitsFigure(stats.finalHits),
  ];
}

function winRateFigure(stats: OwnDashboardStats): ProfileFigure {
  if (stats.winRate === null || !Number.isFinite(stats.winRate)) {
    return notCounted('Win rate', 'None of your matches has a recorded result yet.');
  }

  const record = `${countLabel(stats.wins, 'win', 'wins')}, ${countLabel(stats.losses, 'loss', 'losses')}`;
  const left =
    stats.unknownResults > 0
      ? `; ${countLabel(stats.unknownResults, 'match', 'matches')} with no result left out`
      : '';

  return { label: 'Win rate', value: percentLabel(stats.winRate * 100), detail: `${record}${left}`, counted: true };
}

function kdaFigure(kda: OwnKda | null): ProfileFigure {
  if (kda === null) {
    return notCounted('Kills / deaths / assists', 'None of your matches recorded all three.');
  }

  return {
    label: 'Kills / deaths / assists',
    value: `${one(kda.killsPerMatch)} / ${one(kda.deathsPerMatch)} / ${one(kda.assistsPerMatch)}`,
    detail: `Average per match over ${countLabel(kda.matches, 'match', 'matches')}. KDA ratio ${one(kda.ratio)}.`,
    counted: true,
  };
}

function finalHitsFigure(finalHits: OwnFinalHits | null): ProfileFigure {
  if (finalHits === null) {
    return notCounted('Final hits', 'None of your matches counted them.');
  }

  return {
    label: 'Final hits',
    value: one(finalHits.perMatch),
    detail: `Average per match over ${countLabel(finalHits.matches, 'match', 'matches')} that counted them.`,
    counted: true,
  };
}

function rateFigure(label: string, rate: OwnRate | null): ProfileFigure {
  if (rate === null) {
    return notCounted(label, 'No figures recorded.');
  }

  const sample = countLabel(rate.samples, 'hero-match', 'hero-matches');

  return {
    label,
    value: Math.round(rate.perMinute).toLocaleString('en-US'),
    detail:
      rate.samples < MIN_RATE_SAMPLES
        ? `From only ${sample}, so treat it as a rough guide.`
        : `From ${sample}.`,
    counted: true,
  };
}

function recordFigure(label: string, record: OwnRecord | null, identities: HeroIdentities): ProfileFigure {
  if (record === null) {
    return notCounted(label, null);
  }

  const hero = record.hero === null ? 'Unknown hero' : heroCell(record.hero, identities).name;

  return { label, value: `${record.value}`, detail: `${hero}, ${dateLabel(record.playedAt)}`, counted: true };
}

function topHeroRow(hero: OwnHeroSummary, identities: HeroIdentities): CommunityHeroRow {
  const matches = countLabel(hero.matches, 'match', 'matches');

  return {
    ...heroCell(hero.hero, identities),
    figure: hero.winRate === null ? NOT_COUNTED : percentLabel(hero.winRate * 100),
    sample: hero.kda === null ? matches : `${matches}, KDA ${one(hero.kda.ratio)}`,
  };
}

function recentRow(match: OwnRecentMatch, index: number, identities: HeroIdentities): ProfileRecentMatch {
  const recordedAll = match.kills !== null && match.deaths !== null && match.assists !== null;
  const where = [playModeName(match.playModeId), match.mapName].filter((part) => part !== null);

  return {
    key: `${match.playedAt}-${index}`,
    playedAt: dateLabel(match.playedAt, true),
    hero: match.hero === null ? 'Unknown hero' : heroCell(match.hero, identities).name,
    result: match.result === 'win' ? 'Win' : match.result === 'loss' ? 'Loss' : 'No result recorded',
    outcome: match.result ?? 'unknown',
    kda: recordedAll ? `${match.kills} / ${match.deaths} / ${match.assists}` : NOT_COUNTED,
    finalHits: match.finalHits === null ? NOT_COUNTED : `${match.finalHits}`,
    where: where.length === 0 ? null : where.join(', '),
  };
}

function notCounted(label: string, detail: string | null): ProfileFigure {
  return { label, value: NOT_COUNTED, detail, counted: false };
}

function one(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : NOT_COUNTED;
}

/** Dates are UTC, as on the community pages, so a match is on the same day for everyone. */
function dateLabel(iso: string, withTime = false): string {
  const time = Date.parse(iso);

  return Number.isNaN(time)
    ? 'an unknown date'
    : new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
        timeZone: 'UTC',
      }).format(time);
}
