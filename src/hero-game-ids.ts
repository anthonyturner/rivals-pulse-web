import curatedHeroGameIds from '../data/pulse-atlas/hero-game-ids.json' with { type: 'json' };

export interface HeroGameIdEntry {
  id: string;
  gameId: number;
  gameIdVariants?: readonly { gameId: number }[];
}

/**
 * Game hero id to the hero's id in `heroes.json`. A hero the game splits by role (Deadpool) answers
 * to its base id and to every variant id, so all of them count as the one hero.
 */
export function buildHeroSlugByGameId(entries: readonly HeroGameIdEntry[]): ReadonlyMap<number, string> {
  return new Map(
    entries.flatMap((entry): [number, string][] => [
      [entry.gameId, entry.id],
      ...(entry.gameIdVariants ?? []).map((variant): [number, string] => [variant.gameId, entry.id]),
    ]),
  );
}

export const heroSlugByGameId: ReadonlyMap<number, string> = buildHeroSlugByGameId(curatedHeroGameIds);
