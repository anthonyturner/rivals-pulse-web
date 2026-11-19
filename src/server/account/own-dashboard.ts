import type {
  OwnDashboardStats,
  OwnFinalHits,
  OwnHeroSummary,
  OwnKda,
  OwnPerMinute,
  OwnRate,
  OwnRecentMatch,
  OwnRecord,
  OwnRecords,
} from '../../app/core/auth/own-dashboard.types.ts';
import { heroSlugByGameId } from '../heroes/catalog/hero-game-ids.ts';
import { deriveOwnActivity } from './own-activity.ts';

/** One hero's recorded figures within a match; a blank is null. */
export interface OwnFigureLine {
  heroId: number;
  seconds: number | null;
  damage: number | null;
  healing: number | null;
  blocked: number | null;
}

/** One match the player recorded, as `read_own_dashboard()` returns it; a blank is null. */
export interface OwnDashboardLine {
  playedAt: string;
  /**
   * Assumed to be the hero at the end of the match (not yet confirmed from a real upload); the game
   * does not say which heroes were played before.
   */
  heroId: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  finalHits: number | null;
  isWin: boolean | null;
  playModeId: number | null;
  mapName: string | null;
  figures: readonly OwnFigureLine[];
}

const TOP_HEROES = 5;
const RECENT_MATCHES = 10;

/**
 * Every figure on the dashboard, derived here and nowhere else. A blank is never read as 0: a
 * figure is averaged only over the matches that recorded it, and says how many those were.
 * Lines with a time that cannot be read are the caller's to drop.
 */
export function deriveOwnDashboard(lines: readonly OwnDashboardLine[]): OwnDashboardStats {
  const newestFirst = [...lines].sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));
  const oldestFirst = [...newestFirst].reverse();

  return {
    matches: newestFirst.length,
    ...resultsOf(newestFirst),
    kda: kdaOf(newestFirst),
    finalHits: finalHitsOf(newestFirst),
    topHeroes: topHeroesOf(newestFirst),
    perMinute: perMinuteOf(newestFirst),
    records: recordsOf(newestFirst, oldestFirst),
    recent: newestFirst.slice(0, RECENT_MATCHES).map(recentOf),
    firstPlayedAt: oldestFirst[0]?.playedAt ?? null,
    lastPlayedAt: newestFirst[0]?.playedAt ?? null,
    activity: deriveOwnActivity(newestFirst),
  };
}

function resultsOf(lines: readonly OwnDashboardLine[]) {
  const wins = lines.filter((line) => line.isWin === true).length;
  const losses = lines.filter((line) => line.isWin === false).length;

  return {
    wins,
    losses,
    unknownResults: lines.length - wins - losses,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
  };
}

type ScoredLine = OwnDashboardLine & { kills: number; deaths: number; assists: number };

function isScored(line: OwnDashboardLine): line is ScoredLine {
  return line.kills !== null && line.deaths !== null && line.assists !== null;
}

function kdaOf(lines: readonly OwnDashboardLine[]): OwnKda | null {
  const scored = lines.filter(isScored);

  if (scored.length === 0) {
    return null;
  }

  const kills = sum(scored.map((line) => line.kills));
  const deaths = sum(scored.map((line) => line.deaths));
  const assists = sum(scored.map((line) => line.assists));

  return {
    matches: scored.length,
    kills,
    deaths,
    assists,
    killsPerMatch: kills / scored.length,
    deathsPerMatch: deaths / scored.length,
    assistsPerMatch: assists / scored.length,
    ratio: deaths === 0 ? kills + assists : (kills + assists) / deaths,
  };
}

function finalHitsOf(lines: readonly OwnDashboardLine[]): OwnFinalHits | null {
  const counted = lines.map((line) => line.finalHits).filter((value): value is number => value !== null);

  if (counted.length === 0) {
    return null;
  }

  const total = sum(counted);

  return { matches: counted.length, total, perMatch: total / counted.length };
}

function topHeroesOf(lines: readonly OwnDashboardLine[]): OwnHeroSummary[] {
  const bySlug = new Map<string, OwnDashboardLine[]>();

  for (const line of lines) {
    const slug = slugOf(line.heroId);

    if (slug) {
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), line]);
    }
  }

  return [...bySlug]
    .map(([hero, heroLines]): OwnHeroSummary => {
      const { wins, losses, winRate } = resultsOf(heroLines);

      return { hero, matches: heroLines.length, wins, losses, winRate, kda: kdaOf(heroLines) };
    })
    .sort((a, b) => b.matches - a.matches || a.hero.localeCompare(b.hero))
    .slice(0, TOP_HEROES);
}

function slugOf(heroId: number | null): string | null {
  return heroId === null ? null : (heroSlugByGameId.get(heroId) ?? null);
}

/**
 * A figure over the time it was recorded for. A hero-match line with no time, or no value for that
 * figure, is in neither half of the division, so a blank never drags the rate toward 0.
 */
function perMinuteOf(lines: readonly OwnDashboardLine[]): OwnPerMinute {
  const figures = lines.flatMap((line) => line.figures);
  const rate = (pick: (figure: OwnFigureLine) => number | null): OwnRate | null => {
    const usable = figures.filter(
      (figure) => figure.seconds !== null && figure.seconds > 0 && pick(figure) !== null,
    );

    if (usable.length === 0) {
      return null;
    }

    const seconds = sum(usable.map((figure) => figure.seconds ?? 0));
    const total = sum(usable.map((figure) => pick(figure) ?? 0));

    return { perMinute: (total / seconds) * 60, samples: usable.length };
  };

  return {
    damage: rate((figure) => figure.damage),
    healing: rate((figure) => figure.healing),
    blocked: rate((figure) => figure.blocked),
  };
}

function recordsOf(newestFirst: readonly OwnDashboardLine[], oldestFirst: readonly OwnDashboardLine[]): OwnRecords {
  return {
    mostKills: bestOf(newestFirst, (line) => line.kills),
    mostAssists: bestOf(newestFirst, (line) => line.assists),
    mostFinalHits: bestOf(newestFirst, (line) => line.finalHits),
    longestWinStreak: longestWinStreak(oldestFirst),
  };
}

/** The highest value, and the newest match when two tie. A match that did not record it cannot hold it. */
function bestOf(
  newestFirst: readonly OwnDashboardLine[],
  pick: (line: OwnDashboardLine) => number | null,
): OwnRecord | null {
  let best: OwnRecord | null = null;

  for (const line of newestFirst) {
    const value = pick(line);

    if (value !== null && (best === null || value > best.value)) {
      best = { value, playedAt: line.playedAt, hero: slugOf(line.heroId) };
    }
  }

  return best;
}

function longestWinStreak(oldestFirst: readonly OwnDashboardLine[]): number {
  let longest = 0;
  let current = 0;

  for (const line of oldestFirst) {
    current = line.isWin === true ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

function recentOf(line: OwnDashboardLine): OwnRecentMatch {
  return {
    playedAt: line.playedAt,
    hero: slugOf(line.heroId),
    result: line.isWin === null ? null : line.isWin ? 'win' : 'loss',
    kills: line.kills,
    deaths: line.deaths,
    assists: line.assists,
    finalHits: line.finalHits,
    playModeId: line.playModeId,
    mapName: line.mapName,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
