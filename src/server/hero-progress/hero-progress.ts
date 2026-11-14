import { heroGameIdEntries, type HeroGameIdEntry } from '../heroes/catalog/hero-game-ids.ts';
import { PLAY_MODE_IDS } from '../../contracts/play-modes.ts';
import { matchXpBonuses, type MatchXpBonus } from './hero-xp-bonuses.ts';

/**
 * Hero levels, tiers and stars worked out from a player's uploaded matches, with the desktop app's rules.
 *
 * The block down to `UNPLAYED_HERO_PROGRESS` is the overlay's `hero-progress.ts` as it is (overlay `ebc239ba`), and
 * `hero-xp-bonuses.ts` beside it is the overlay's file as it is (overlay `5038e469`). A change to a number, a tier
 * or a bonus is made in both repositories in step, and the boundary specs here and there must pass unchanged.
 * Only `heroProgress` differs: it reads the website's upload rows where the overlay reads its local match records,
 * so its inputs are described under `UploadedMatch`.
 *
 * Nothing is stored and no level is ever read from a client: the same matches always give the same levels.
 */

/** XP for playing a hero in a counted match, whatever the time or result. */
export const XP_PER_MATCH = 100;
/** XP for each full minute on the hero, up to `XP_MINUTES_CAP`. */
export const XP_PER_MINUTE = 10;
/** Minutes on a hero past which a match earns no more time XP (a damaged record cannot jump a level). */
export const XP_MINUTES_CAP = 30;
export const XP_PER_WIN = 50;
/** XP from level 1 to level 2; every later level costs `XP_LEVEL_STEP` more than the one before. */
export const XP_FIRST_LEVEL = 500;
export const XP_LEVEL_STEP = 100;

/** The tier's position, 1 (lowest) to 6; the frame colours are named by it, never by hue. */
export type HeroTierKey = 1 | 2 | 3 | 4 | 5 | 6;

/** A named band of hero levels, from `minLevel` up to the next tier's `minLevel`. */
export interface HeroTier {
  readonly key: HeroTierKey;
  readonly name: string;
  readonly minLevel: number;
}

/** The hero tiers, lowest first. */
export const HERO_TIERS: readonly HeroTier[] = [
  { key: 1, name: 'Recruit', minLevel: 1 },
  { key: 2, name: 'Regular', minLevel: 5 },
  { key: 3, name: 'Veteran', minLevel: 10 },
  { key: 4, name: 'Elite', minLevel: 20 },
  { key: 5, name: 'Champion', minLevel: 35 },
  { key: 6, name: 'Legend', minLevel: 50 },
];

/** Past the last tier's `minLevel`, a hero earns one star for every this many levels. */
export const HERO_STAR_LEVELS = 25;

/** The highest tier whose `minLevel` the level reaches; a level below 1 (never produced) is still Recruit. */
export function heroTierForLevel(level: number): HeroTier {
  return [...HERO_TIERS].reverse().find(tier => level >= tier.minLevel) ?? HERO_TIERS[0];
}

/** Stars earned past the top tier: none until `HERO_STAR_LEVELS` levels after it starts (level 75 is the first). */
export function heroStarsForLevel(level: number): number {
  const top = HERO_TIERS[HERO_TIERS.length - 1].minLevel;
  return Math.max(0, Math.floor((level - top) / HERO_STAR_LEVELS));
}

/** A hero's experience and where it puts the hero on the level curve. The levels never stop; there is no cap. */
export interface HeroProgress {
  readonly xp: number;
  readonly level: number;
  /** The tier `level` falls in. */
  readonly tier: HeroTier;
  /** XP earned since reaching `level`. */
  readonly xpIntoLevel: number;
  /** XP the whole of `level` costs, so the next level is reached at `xpIntoLevel === xpForLevel`. */
  readonly xpForLevel: number;
}

/** Total XP needed to reach `level`; level 1 needs none. */
function xpToReach(level: number): number {
  return XP_FIRST_LEVEL * (level - 1) + (XP_LEVEL_STEP / 2) * (level - 1) * (level - 2);
}

/** Where `xp` falls on the level curve: the largest level whose total is within it. */
export function progressForXp(xp: number): HeroProgress {
  let level = 1;
  while (xpToReach(level + 1) <= xp) level++;
  const start = xpToReach(level);
  return { xp, level, tier: heroTierForLevel(level), xpIntoLevel: xp - start, xpForLevel: xpToReach(level + 1) - start };
}

/** What a hero nobody has played yet shows: level 1 with no XP. */
export const UNPLAYED_HERO_PROGRESS: HeroProgress = progressForXp(0);

/** The hero's slug, or `slug:Role` for a hero the game splits by role (Deadpool); the key of a hero's progress. */
export type HeroKey = string;

/** One hero's recorded time in a match, as `participant_hero_figures` holds it; a blank is null. */
export interface HeroFigure {
  readonly heroId: number;
  readonly seconds: number | null;
  readonly damage: number | null;
  readonly healing: number | null;
  readonly blocked: number | null;
}

/**
 * One match the account uploaded, as the rules read it.
 *
 * - `matchKey` tells matches apart and breaks a tie in end time; it must be different for every match.
 * - `endedAt` is when the match ended, in milliseconds (`participants.played_at`, the overlay's `endedAt`).
 * - `playModeId` decides whether it counts: only Quick Match and Competitive do.
 * - `heroId` is the hero on the account's own line, used only when the match has no `figures`.
 */
export interface UploadedMatch {
  readonly matchKey: string;
  readonly endedAt: number;
  readonly isWin: boolean | null;
  readonly playModeId: number | null;
  readonly halfSeason: number | null;
  readonly heroId: number | null;
  readonly figures: readonly HeroFigure[];
}

/** The key of the hero or role form a game hero id is, or null for an id with none (an unknown hero, Deadpool's base id). */
export type HeroKeyResolver = (gameId: number) => HeroKey | null;

/** Time on a hero that counts as playing it (a shorter stay counts only if the hero did something). */
export const HERO_APPEARANCE_MIN_SECONDS = 30;

const COUNTED_PLAY_MODE_IDS: readonly number[] = [PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive];

/** The overlay's `heroFormKey`, over the game hero ids the site knows: a role form is `slug:Role`, the base id of a hero with role forms is no hero. */
export function buildHeroKeyResolver(entries: readonly HeroGameIdEntry[]): HeroKeyResolver {
  const keys = new Map<number, HeroKey>();
  for (const { id, gameId, gameIdVariants } of entries) {
    if (!gameIdVariants?.length) {
      keys.set(gameId, id);
      continue;
    }
    for (const { gameId: variantId, role } of gameIdVariants) {
      if (role) keys.set(variantId, `${id}:${role}`);
    }
  }
  return gameId => keys.get(gameId) ?? null;
}

const siteHeroKey: HeroKeyResolver = buildHeroKeyResolver(heroGameIdEntries);

interface MatchCredit {
  readonly matchKey: string;
  readonly isWin: boolean;
  readonly seconds: number;
}

/**
 * The overlay's `heroAppearances` and `creditGroups`: every hero played in the match, once each with its stays added.
 * A figure counts at `HERO_APPEARANCE_MIN_SECONDS` or with any damage, healing or blocked (the website has no
 * per-hero kills to add). A match with no figures gives the whole match to the hero on the account's line, with
 * no time because `participants` holds no match length.
 */
function creditsFor(match: UploadedMatch, resolveKey: HeroKeyResolver): Map<HeroKey, MatchCredit> {
  const played: { heroId: number; seconds: number }[] = match.figures.length
    ? match.figures
        .filter(({ seconds, damage, healing, blocked }) => (seconds ?? 0) >= HERO_APPEARANCE_MIN_SECONDS || (damage ?? 0) > 0 || (healing ?? 0) > 0 || (blocked ?? 0) > 0)
        .map(({ heroId, seconds }) => ({ heroId, seconds: seconds ?? 0 }))
    : match.heroId === null
      ? []
      : [{ heroId: match.heroId, seconds: 0 }];
  const credits = new Map<HeroKey, MatchCredit>();
  for (const { heroId, seconds } of played) {
    const key = resolveKey(heroId);
    if (key === null) continue;
    credits.set(key, { matchKey: match.matchKey, isWin: match.isWin === true, seconds: (credits.get(key)?.seconds ?? 0) + seconds });
  }
  return credits;
}

/** XP one counted match gives the hero: a flat amount, minutes on the hero (capped), a win bonus and what the match earned as a first win or after a break. */
function xpForMatch({ isWin, seconds, matchKey }: MatchCredit, bonuses: ReadonlyMap<string, MatchXpBonus>): number {
  const minutes = Math.floor(Math.min(Math.max(seconds, 0), XP_MINUTES_CAP * 60) / 60);
  return XP_PER_MATCH + XP_PER_MINUTE * minutes + (isWin ? XP_PER_WIN : 0) + (bonuses.get(matchKey)?.xp ?? 0);
}

/**
 * Each hero's progress from the account's matches in every season. With `halfSeason`, only that season's matches
 * count and the bonuses are worked out among them alone: the season track starts from nothing each season while the
 * all-time levels never reset. A hero with no counted match has no entry.
 *
 * The first-win and rested bonuses follow the account's whole run of counted matches, not one hero's, and every
 * hero played in the match gets the bonus, as with a win.
 */
export function heroProgress(
  matches: readonly UploadedMatch[],
  halfSeason?: number,
  resolveKey: HeroKeyResolver = siteHeroKey,
): ReadonlyMap<HeroKey, HeroProgress> {
  const counted = matches.filter(
    match => match.playModeId !== null && COUNTED_PLAY_MODE_IDS.includes(match.playModeId) && (halfSeason === undefined || match.halfSeason === halfSeason),
  );
  const bonuses = matchXpBonuses(counted.map(({ matchKey, endedAt, isWin }) => ({ matchKey, endedAt, won: isWin === true })));
  const xp = new Map<HeroKey, number>();
  for (const match of counted) {
    for (const [key, credit] of creditsFor(match, resolveKey)) {
      xp.set(key, (xp.get(key) ?? 0) + xpForMatch(credit, bonuses));
    }
  }
  return new Map([...xp].map(([key, total]) => [key, progressForXp(total)]));
}

/** The all-time progress and the progress inside each half-season that has a counted match. */
export interface HeroProgressTracks {
  readonly allTime: ReadonlyMap<HeroKey, HeroProgress>;
  readonly byHalfSeason: ReadonlyMap<number, ReadonlyMap<HeroKey, HeroProgress>>;
}

export function heroProgressTracks(matches: readonly UploadedMatch[], resolveKey: HeroKeyResolver = siteHeroKey): HeroProgressTracks {
  const halfSeasons = new Set(matches.flatMap(({ halfSeason }) => (halfSeason === null ? [] : [halfSeason])));
  return {
    allTime: heroProgress(matches, undefined, resolveKey),
    byHalfSeason: new Map(
      [...halfSeasons]
        .sort((first, second) => second - first)
        .map(halfSeason => [halfSeason, heroProgress(matches, halfSeason, resolveKey)] as const)
        .filter(([, progress]) => progress.size > 0),
    ),
  };
}
