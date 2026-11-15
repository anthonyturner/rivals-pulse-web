import type { HeroKey, HeroKeyResolver } from './hero-progress.ts';
import type { XpBonusMatch } from './hero-xp-bonuses.ts';

/**
 * The XP of matches the site no longer holds, frozen by the retention purge so a hero level never falls when
 * `participants` rows are deleted (ADR-0008, Decision 7).
 *
 * The purge works the XP out in SQL with the rules in `hero-progress.ts`, before it deletes, and keeps only totals:
 * for one account, per half-season and hero, the XP from playing (`baseXp`: the flat amount and the win),
 * from the minutes on the hero (`timeXp`) and from the first-win and rested bonuses (`bonusXp`). The hero is the game's
 * hero id, because the database does not know the website's hero keys; `HeroKeyResolver` turns it into one on read.
 * `supabase/checks/hero_xp_carry_overs.sql` holds the fixture both implementations are held to.
 */
export interface HeroXpCarryOver {
  readonly halfSeason: number;
  readonly heroId: number;
  readonly baseXp: number;
  readonly timeXp: number;
  readonly bonusXp: number;
}

/**
 * Everything frozen for an account. The two times say where the bonus chains stood after the last frozen match,
 * in milliseconds, so the first-win and rested bonuses carry on across the purge: the end of the last match that
 * earned the first-win bonus, and the end of the last counted match. Both are null while nothing is frozen.
 */
export interface HeroXpCarry {
  readonly overs: readonly HeroXpCarryOver[];
  readonly lastBonusWinAt: number | null;
  readonly lastCountedAt: number | null;
}

/** An account the purge has frozen nothing for. */
export const NO_HERO_XP_CARRY: HeroXpCarry = { overs: [], lastBonusWinAt: null, lastCountedAt: null };

/**
 * Matches that leave the bonus chains where the purge left them, to go in front of the matches still held.
 * `matchXpBonuses` reads only end times and results, so a won match at the last first win and a lost one at the last
 * counted match put its two running times back exactly, with no change to the overlay's copied file.
 * Their own bonuses are never credited to anyone, and their keys start with `!`, which sorts before any line id, so a held match
 * that ended at the very same millisecond still comes after them.
 */
export function chainSeedMatches({ lastBonusWinAt, lastCountedAt }: HeroXpCarry): XpBonusMatch[] {
  const seed: XpBonusMatch[] = [];
  if (lastBonusWinAt !== null) seed.push({ matchKey: '!first-win', endedAt: lastBonusWinAt, won: true });
  if (lastCountedAt !== null && lastCountedAt !== lastBonusWinAt) seed.push({ matchKey: '!last-counted', endedAt: lastCountedAt, won: false });
  return seed;
}

/** The frozen XP of each hero, over every half-season. A game hero id with no hero key earns nothing, as in a live match. */
export function carriedXp(carry: HeroXpCarry, resolveKey: HeroKeyResolver): ReadonlyMap<HeroKey, number> {
  const xp = new Map<HeroKey, number>();
  for (const { heroId, baseXp, timeXp, bonusXp } of carry.overs) {
    const key = resolveKey(heroId);
    if (key !== null) xp.set(key, (xp.get(key) ?? 0) + baseXp + timeXp + bonusXp);
  }
  return xp;
}
