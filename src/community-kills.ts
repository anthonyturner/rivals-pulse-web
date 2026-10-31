import type { CommunityKillPair, CommunityKills, CommunityKillsMinimums } from './contracts/community-kills.model.js';
import { chooseHalfSeason, halfSeasonTimeline, type HalfSeasonStart } from './hero-stats.js';

/**
 * Every kill-feed counter on the site is derived here and nowhere else, from the counts in
 * `hero_kill_aggregates` as `read_community_kill_feed()` returns them. A pair is "seen kills": the
 * recorder's client only sees part of the feed, and one feed is stored per match. It describes what
 * was seen; it does not say whom to pick or ban.
 */

/**
 * Matches whose stored feed had the pair before it is listed: the same bar as a hero matchup. With
 * at least one kill in each of those matches, a listed pair has at least this many seen kills.
 */
export const COMMUNITY_KILLS_MINIMUMS: CommunityKillsMinimums = {
  pairMatches: 10,
  // Mirrors `community_bucket_shown` in the database, which is where the privacy rule is applied: a
  // pair that fewer players recorded (or that one player mostly recorded) never reaches this code.
  recorders: 3,
};

/** Pairs kept per hero as killer and as victim; the payload holds no pair that is in neither list. */
export const KILL_FEED_PAIRS_PER_HERO = 5;

/**
 * The volume bands, as the floor a "25+ seen kills" label states. The exact count of a pair next to
 * hidden ones would give away how much the database left out, so only the band leaves this module.
 */
export const KILL_VOLUME_BANDS: readonly number[] = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** The largest band the count reaches, or null below the smallest. */
export function killVolumeBand(kills: number): number | null {
  return [...KILL_VOLUME_BANDS].reverse().find((band) => kills >= band) ?? null;
}

/** One killer and victim in one half-season, as `read_community_kill_feed()` returns it. */
export interface KillPairRow {
  halfSeason: number;
  /** A hero slug, as the app sends it and as `heroes.json` spells the hero id. */
  killerHero: string;
  victimHero: string;
  /** Seen kills of the pair across the stored feeds. */
  kills: number;
  /** Stored feeds that had the pair. */
  matches: number;
}

export interface CommunityKillsSource {
  halfSeasons: readonly HalfSeasonStart[];
  pairs: readonly KillPairRow[];
}

export interface DeriveCommunityKillsOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /** Hero ids this site knows. A pair naming any other slug is left out. */
  knownHeroes: ReadonlySet<string>;
}

export function deriveCommunityKills(source: CommunityKillsSource, options: DeriveCommunityKillsOptions): CommunityKills {
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    source.pairs.map((row) => row.halfSeason),
    options.now,
  );
  const pairsOf = (halfSeason: number): CommunityKillPair[] =>
    listedPairs(
      source.pairs.filter(
        (row) =>
          row.halfSeason === halfSeason &&
          row.matches >= COMMUNITY_KILLS_MINIMUMS.pairMatches &&
          options.knownHeroes.has(row.killerHero) &&
          options.knownHeroes.has(row.victimHero),
      ),
    );

  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => pairsOf(id).length > 0);
  const pairs = shown === undefined ? [] : pairsOf(shown);

  return {
    status: pairs.length > 0 ? 'ready' : 'not-enough-data',
    minimums: { ...COMMUNITY_KILLS_MINIMUMS },
    halfSeasons: timeline.started.map(timeline.describe),
    halfSeason: shown === undefined ? null : timeline.describe(shown),
    inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
    pairs,
  };
}

/** The pairs that are among their killer's or their victim's best, most seen kills first. */
function listedPairs(rows: readonly KillPairRow[]): CommunityKillPair[] {
  const ranked = [...rows].sort(
    (a, b) => b.kills - a.kills || a.killerHero.localeCompare(b.killerHero) || a.victimHero.localeCompare(b.victimHero),
  );
  const taken = { killer: new Map<string, number>(), victim: new Map<string, number>() };
  const claim = (side: 'killer' | 'victim', hero: string): boolean => {
    const count = taken[side].get(hero) ?? 0;
    taken[side].set(hero, count + 1);

    return count < KILL_FEED_PAIRS_PER_HERO;
  };

  // Both sides are claimed for every pair, so a pair kept by one list still takes its place in the other.
  return ranked
    .filter((row) => [claim('killer', row.killerHero), claim('victim', row.victimHero)].some(Boolean))
    .flatMap((row): CommunityKillPair[] => {
      const killsBand = killVolumeBand(row.kills);

      // Every listed pair has at least `pairMatches` matches, so a band always exists; a feed that
      // somehow broke that is left out rather than shown without a figure.
      return killsBand === null ? [] : [{ killer: row.killerHero, victim: row.victimHero, killsBand }];
    });
}
