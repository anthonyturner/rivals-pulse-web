import type { HeroStats, HeroStatsHalfSeason } from '../../../contracts/hero-stats.model.ts';
import type {
  HeroSpecialists,
  HeroSpecialistsBucket,
  HeroSpecialistsDefinition,
  HeroSpecialistsHero,
  HeroSpecialistsMatchesBand,
} from '../../../contracts/hero-specialists.model.ts';
import { chooseHalfSeason, halfSeasonTimeline, type HalfSeasonStart } from '../stats/hero-stats.ts';
import { estimateWinRatePriors, shrunkRate } from '../stats/win-rate-prior.ts';

/**
 * Every specialist and flex figure on the site is derived here, from the pooled counts that
 * `read_hero_specialists()` returns. The database sorts people into the two buckets and applies the
 * gates, and the constants below print what it applies; `hero-specialists-migration.test.ts` compares
 * them with the migration. Nothing here sees a person: the answer has no uid, name or recorder.
 */

/** A specialist on a hero played at least this percent of their counted matches on it... */
export const SPECIALIST_MIN_SHARE_PERCENT = 50;
/** ...and at least this many matches on it. */
export const SPECIALIST_MIN_HERO_MATCHES = 10;
/** A flex player's most played hero is under this percent of their counted matches... */
export const FLEX_MAX_TOP_SHARE_PERCENT = 25;
/** ...they played at least this many heroes... */
export const FLEX_MIN_HEROES = 5;
/** ...and have at least this many counted matches. */
export const FLEX_MIN_MATCHES = 20;

/** Different players each bucket of a hero needs. Two are too few: either could subtract their own record. */
export const HERO_SPECIALISTS_MIN_PLAYERS = 5;
/** Different recorders behind each bucket. Applied by the database only; no count of them is returned. */
export const HERO_SPECIALISTS_MIN_RECORDERS = 2;
/** Matches each bucket of a hero needs. */
export const HERO_SPECIALISTS_MIN_MATCHES = 50;

/** The `matchesBand` steps, largest first. The first is the minimum, so a shown bucket always has one. */
const MATCHES_BANDS: readonly (readonly [number, HeroSpecialistsMatchesBand])[] = [
  [500, '500+'],
  [250, '250+'],
  [100, '100+'],
  [HERO_SPECIALISTS_MIN_MATCHES, '50+'],
];

export const HERO_SPECIALISTS_DEFINITION: HeroSpecialistsDefinition = {
  specialistMinShare: SPECIALIST_MIN_SHARE_PERCENT / 100,
  specialistMinHeroMatches: SPECIALIST_MIN_HERO_MATCHES,
  flexMaxTopShare: FLEX_MAX_TOP_SHARE_PERCENT / 100,
  flexMinHeroes: FLEX_MIN_HEROES,
  flexMinMatches: FLEX_MIN_MATCHES,
};

/** One hero in one half-season with both buckets that passed the database's gates, as the reader returns it. */
export interface HeroSpecialistRow {
  halfSeason: number;
  /** The game's hero id, with Deadpool's role forms merged under 1057. */
  gameHeroId: number;
  specialistMatches: number;
  specialistWins: number;
  flexMatches: number;
  flexWins: number;
}

interface SpecialistsHalfSeasonChoice {
  shown?: number;
  /** Set only when `shown` is the previous half-season, standing in for this current one. */
  inPlaceOf?: number;
  describe(id: number): HeroStatsHalfSeason;
}

interface HeroSpecialistsDerivation {
  specialists: HeroSpecialists;
  /** Game hero ids in the rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

/** The rows a hero can be shown from: both buckets at the minimum matches, and a hero the site knows. */
function usableRows(
  rows: readonly HeroSpecialistRow[],
  halfSeason: number,
  heroSlugByGameId: ReadonlyMap<number, string>,
): { usable: Map<string, HeroSpecialistRow>; excludedGameIds: Set<number> } {
  const usable = new Map<string, HeroSpecialistRow>();
  const excludedGameIds = new Set<number>();

  for (const row of rows.filter((candidate) => candidate.halfSeason === halfSeason)) {
    const hero = heroSlugByGameId.get(row.gameHeroId);

    if (hero === undefined) {
      excludedGameIds.add(row.gameHeroId);
    } else if (
      Math.min(row.specialistMatches, row.flexMatches) >= HERO_SPECIALISTS_MIN_MATCHES &&
      row.specialistWins <= row.specialistMatches &&
      row.flexWins <= row.flexMatches
    ) {
      usable.set(hero, row);
    }
  }

  return { usable, excludedGameIds };
}

/**
 * Which half-season the figures come from: the current one, or the previous one while the current has
 * no hero to show and the previous has, as the other community readers do.
 */
export function chooseSpecialistsHalfSeason(
  rows: readonly HeroSpecialistRow[],
  halfSeasons: readonly HalfSeasonStart[],
  now: Date,
  heroSlugByGameId: ReadonlyMap<number, string>,
): SpecialistsHalfSeasonChoice {
  const timeline = halfSeasonTimeline(
    halfSeasons,
    rows.map((row) => row.halfSeason),
    now,
  );
  const { shown, inPlaceOf } = chooseHalfSeason(
    timeline,
    undefined,
    (id) => usableRows(rows, id, heroSlugByGameId).usable.size > 0,
  );

  return { shown, inPlaceOf, describe: timeline.describe };
}

/**
 * The specialist and flex figures for the half-season `choice` picked. `ownStats` is `getHeroStats` for
 * that same half-season, the shared input: each bucket is pulled toward the hero's own win rate, with
 * the strength `estimateWinRatePriors` finds across all the heroes' records. A hero whose own record is
 * not placed in the hero stats has nothing to pull toward, so it is not shown. With no `ownStats`
 * (no half-season exists) no hero is listed.
 */
export function deriveHeroSpecialists(
  rows: readonly HeroSpecialistRow[],
  choice: SpecialistsHalfSeasonChoice,
  ownStats: HeroStats | undefined,
  heroSlugByGameId: ReadonlyMap<number, string>,
): HeroSpecialistsDerivation {
  const { shown, inPlaceOf } = choice;
  const { usable, excludedGameIds } =
    shown === undefined ? { usable: new Map<string, HeroSpecialistRow>(), excludedGameIds: new Set<number>() } : usableRows(rows, shown, heroSlugByGameId);
  const own = new Map(
    (ownStats?.tiers ?? []).flatMap((tier) => tier.heroes).map((hero) => [hero.hero, { matches: hero.appearances, wins: hero.wins }]),
  );
  const strength = estimateWinRatePriors([...own.values()]).strength;
  const listed = new Set([
    ...own.keys(),
    ...(ownStats?.belowMinimum ?? []).map((hero) => hero.hero),
    ...usable.keys(),
  ]);
  const heroes = [...listed].sort().map((hero): HeroSpecialistsHero => {
    const row = usable.get(hero);
    const record = own.get(hero);

    return row === undefined || record === undefined || record.matches <= 0
      ? { hero, status: 'not-enough-data' }
      : {
          hero,
          status: 'ready',
          specialist: bucketOf(row.specialistWins, row.specialistMatches, record, strength),
          flex: bucketOf(row.flexWins, row.flexMatches, record, strength),
        };
  });

  return {
    specialists: {
      status: heroes.some((hero) => hero.status === 'ready') ? 'ready' : 'not-enough-data',
      definition: HERO_SPECIALISTS_DEFINITION,
      minimumMatches: HERO_SPECIALISTS_MIN_MATCHES,
      minimumPlayers: HERO_SPECIALISTS_MIN_PLAYERS,
      halfSeason: shown === undefined ? null : choice.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : choice.describe(inPlaceOf),
      heroes,
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

// Built field by field, so a count added to the rows can never reach the public response without being
// named here: the exact matches and wins stay on this side.
function bucketOf(
  wins: number,
  matches: number,
  own: { matches: number; wins: number },
  strength: number,
): HeroSpecialistsBucket {
  return {
    winRate: oneDecimal((wins / matches) * 100),
    shrunkWinRate: oneDecimal(shrunkRate({ matches, wins }, { mean: own.wins / own.matches, strength }) * 100),
    matchesBand: bandOf(matches),
  };
}

/** The largest band a bucket's matches reach. The caller has checked it has the minimum, which is the smallest. */
function bandOf(matches: number): HeroSpecialistsMatchesBand {
  return MATCHES_BANDS.find(([floor]) => matches >= floor)?.[1] ?? '50+';
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
