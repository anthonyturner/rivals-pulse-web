/** XP for the first counted win after `FIRST_WIN_GAP_MS` has passed since the last win that earned it. */
export const XP_FIRST_WIN_BONUS = 150;
/** XP for the first counted match that ends `RESTED_GAP_MS` or more after the previous counted match ended. */
export const XP_RESTED_BONUS = 100;
/** About a day, so the first-win bonus comes once a day with no time zone to agree on. */
export const FIRST_WIN_GAP_MS = 20 * 60 * 60 * 1000;
export const RESTED_GAP_MS = 2 * 60 * 60 * 1000;

/** The part of a counted match the bonuses read. */
export interface XpBonusMatch {
  readonly matchKey: string;
  readonly endedAt: number;
  readonly won: boolean;
}

/** What one match earned on top of its base XP; the two stack. */
export interface MatchXpBonus {
  readonly firstWin: boolean;
  readonly rested: boolean;
  readonly xp: number;
}

function inPlayOrder(first: XpBonusMatch, second: XpBonusMatch): number {
  if (first.endedAt !== second.endedAt) return first.endedAt - second.endedAt;
  return first.matchKey < second.matchKey ? -1 : first.matchKey > second.matchKey ? 1 : 0;
}

/**
 * The bonus each counted match earned, by match key, worked out from end times alone (the same matches always
 * give the same bonuses, in any order). Both gaps are measured end to end because the website stores only when a
 * match ended. Keep this file free of imports: the website copies it as it is, and `npm run lint` fails when it
 * stops being copyable.
 *
 * The first match there is earns no rested bonus, since nothing came before it to rest from.
 */
export function matchXpBonuses(matches: readonly XpBonusMatch[]): ReadonlyMap<string, MatchXpBonus> {
  const bonuses = new Map<string, MatchXpBonus>();
  let previousEndedAt: number | null = null;
  let lastFirstWinAt: number | null = null;

  for (const match of [...matches].sort(inPlayOrder)) {
    const rested = previousEndedAt !== null && match.endedAt - previousEndedAt >= RESTED_GAP_MS;
    const firstWin = match.won && (lastFirstWinAt === null || match.endedAt - lastFirstWinAt >= FIRST_WIN_GAP_MS);

    if (firstWin) lastFirstWinAt = match.endedAt;
    previousEndedAt = match.endedAt;
    bonuses.set(match.matchKey, {
      firstWin,
      rested,
      xp: (firstWin ? XP_FIRST_WIN_BONUS : 0) + (rested ? XP_RESTED_BONUS : 0),
    });
  }

  return bonuses;
}
