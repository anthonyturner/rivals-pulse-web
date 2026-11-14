import type {
  TripleSupportTrio,
  TripleSupportTrios,
  TripleSupportVariant,
} from '../../../contracts/triple-support-trios.model.ts';
import type { StrategistTag } from '../../../contracts/strategist-tags.model.ts';
import {
  BLENDED_PLAY_MODE_IDS,
  chooseHalfSeason,
  halfSeasonTimeline,
  modesOf,
  playModeFromQuery,
  type HeroStatsSource,
} from '../stats/hero-stats.ts';

/**
 * Every triple-support figure on the site is derived here, from the counts in
 * `triple_support_trios` and `triple_support_totals` as `read_triple_support_trios()` returns them.
 * Counts only: a win rate is the reader's to compute from `wins` and `teams`.
 */

/**
 * Matches with a win or a loss in which a trio was seen before it is shown. Keep it equal to
 * `public.triple_support_min_matches()`, which the database applies first; applying it again here
 * keeps a thinner trio out if that function ever changes.
 */
export const TRIPLE_SUPPORT_MIN_MATCHES = 10;

/** The modes the counts blend when no mode is asked for: the same Competitive and Quick Match blend as the hero stats. */
export const TRIPLE_SUPPORT_PLAY_MODE_IDS: readonly number[] = BLENDED_PLAY_MODE_IDS;

/**
 * `rank_bucket` of rows with no rank: every row today. Once buckets of 0 or more exist, -1 means
 * "unknown rank", not "all ranks", so the figures are built from these rows alone and never by
 * adding buckets together (a bucket the database hid for too few recorders would be inside the sum).
 */
export const UNKNOWN_RANK_BUCKET = -1;

const THREE_HEALERS = 'Three healers';

/**
 * One trio in one half-season and rank bucket, summed over the modes asked for, as
 * `read_triple_support_trios()` returns it. The team counts are the half-season's, repeated on
 * every row.
 */
export interface TripleSupportRow {
  halfSeason: number;
  rankBucket: number;
  /** The three Strategists' game hero ids, ascending. */
  heroA: number;
  heroB: number;
  heroC: number;
  matches: number;
  teams: number;
  wins: number;
  classifiedTeams: number;
  unclassifiedTeams: number;
  fourPlusTeams: number;
}

interface DeriveTripleSupportTriosOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /**
   * The `mode` query value that the rows were read for; see `playModeFromQuery`. None is the Quick
   * Match and Competitive blend, and a value naming no mode counts nothing.
   */
  mode?: string;
  /** Base game id to the hero's tag. A Strategist missing here cannot be named, so its trio is left out. */
  tagByGameId: ReadonlyMap<number, StrategistTag>;
  /** Base game id to the hero's display name. A utility hero missing here cannot be named, so its trio is left out. */
  nameByGameId: ReadonlyMap<number, string>;
  /** Base game id to the hero's id in `heroes.json`. A Strategist missing here cannot be shown, so its trio is left out. */
  slugByGameId: ReadonlyMap<number, string>;
}

interface TripleSupportDerivation {
  trios: TripleSupportTrios;
  /** Game hero ids in the counted rows that have no tag or no slug, or no name for a utility hero, so their trios were left out. */
  unnamedGameIds: number[];
}

interface HalfSeasonSnapshot {
  trios: TripleSupportTrio[];
  classifiedTeams: number;
  unclassifiedTeams: number;
  fourPlusTeams: number;
  unnamedGameIds: Set<number>;
}

export function deriveTripleSupportTrios(
  rows: readonly TripleSupportRow[],
  source: Pick<HeroStatsSource, 'halfSeasons' | 'totals'>,
  options: DeriveTripleSupportTriosOptions,
): TripleSupportDerivation {
  const timeline = halfSeasonTimeline(source.halfSeasons, rows.map((row) => row.halfSeason), options.now);
  const mode = playModeFromQuery(options.mode);
  const unnamedGameIds = new Set<number>();
  const snapshots = new Map<number, HalfSeasonSnapshot>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    let result = snapshots.get(id);

    if (result === undefined) {
      result = snapshotOf(rows, id, options);
      result.unnamedGameIds.forEach((gameId) => unnamedGameIds.add(gameId));
      snapshots.set(id, result);
    }

    return result;
  };
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => snapshot(id).trios.length > 0);
  const counted = shown === undefined ? undefined : snapshot(shown);

  return {
    trios: {
      status: counted !== undefined && counted.trios.length > 0 ? 'ready' : 'not-enough-data',
      minimumMatches: TRIPLE_SUPPORT_MIN_MATCHES,
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      halfSeasons: timeline.started.map(timeline.describe),
      mode: mode?.id ?? null,
      modes: modesOf(source, shown),
      classifiedTeams: counted?.classifiedTeams ?? 0,
      unclassifiedTeams: counted?.unclassifiedTeams ?? 0,
      fourPlusTeams: counted?.fourPlusTeams ?? 0,
      trios: counted?.trios ?? [],
    },
    unnamedGameIds: [...unnamedGameIds].sort((a, b) => a - b),
  };
}

function snapshotOf(
  rows: readonly TripleSupportRow[],
  halfSeason: number,
  options: DeriveTripleSupportTriosOptions,
): HalfSeasonSnapshot {
  const own = rows.filter((row) => row.halfSeason === halfSeason && row.rankBucket === UNKNOWN_RANK_BUCKET);
  const unnamedGameIds = new Set<number>();
  const trios: TripleSupportTrio[] = [];

  for (const row of own) {
    const heroIds: [number, number, number] = [row.heroA, row.heroB, row.heroC];
    const variant = variantOf(heroIds, options.tagByGameId, options.nameByGameId);

    const slugs = heroIds.map((gameId) => options.slugByGameId.get(gameId));

    // The database counts a trio only for known Strategists, so a hero that cannot be named means the
    // tag list, the hero ids or the hero names are behind the role list; a trio nobody can name is
    // left out and reported.
    if ('unnamed' in variant || !isThree(slugs)) {
      const unslugged = heroIds.filter((gameId) => !options.slugByGameId.has(gameId));

      [...('unnamed' in variant ? variant.unnamed : []), ...unslugged].forEach((gameId) => unnamedGameIds.add(gameId));
      continue;
    }

    if (row.matches < TRIPLE_SUPPORT_MIN_MATCHES || row.teams <= 0) {
      continue;
    }

    trios.push({
      heroIds,
      heroes: slugs,
      variant,
      matches: row.matches,
      teams: row.teams,
      wins: row.wins,
      share: row.classifiedTeams > 0 ? Math.round((row.teams / row.classifiedTeams) * 10_000) / 10_000 : 0,
    });
  }

  trios.sort((a, b) => b.matches - a.matches || compareIds(a.heroIds, b.heroIds));

  return {
    trios,
    // Every row of a half-season carries the same team counts; they are 0 while no trio is listed.
    classifiedTeams: trios.length > 0 ? own[0].classifiedTeams : 0,
    unclassifiedTeams: trios.length > 0 ? own[0].unclassifiedTeams : 0,
    fourPlusTeams: trios.length > 0 ? own[0].fourPlusTeams : 0,
    unnamedGameIds,
  };
}

/**
 * What a trio is called. The utility heroes name it, by display name in alphabetical order, joined
 * with " + " and followed by " triple" ("Adam Warlock + Mantis triple"); a trio with none is "Three
 * healers". Returns the game ids that cannot be named instead when a hero has no tag or a utility
 * hero has no name.
 */
export function variantOf(
  heroIds: readonly number[],
  tagByGameId: ReadonlyMap<number, StrategistTag>,
  nameByGameId: ReadonlyMap<number, string>,
): TripleSupportVariant | { unnamed: number[] } {
  const untagged = heroIds.filter((gameId) => !tagByGameId.has(gameId));
  const utility = [...new Set(heroIds.filter((gameId) => tagByGameId.get(gameId) === 'utility'))];
  const unnamedUtility = utility.filter((gameId) => !nameByGameId.has(gameId));

  if (untagged.length > 0 || unnamedUtility.length > 0) {
    return { unnamed: [...untagged, ...unnamedUtility] };
  }

  const anchors = utility
    .map((gameId) => ({ gameId, name: nameByGameId.get(gameId) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    label: anchors.length === 0 ? THREE_HEALERS : `${anchors.map((anchor) => anchor.name).join(' + ')} triple`,
    anchorHeroIds: anchors.map((anchor) => anchor.gameId),
  };
}

function isThree(slugs: readonly (string | undefined)[]): slugs is [string, string, string] {
  return slugs.length === 3 && slugs.every((slug) => slug !== undefined);
}

function compareIds(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}
