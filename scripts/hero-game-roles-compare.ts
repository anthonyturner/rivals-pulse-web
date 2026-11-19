import { buildHeroRoleByGameId, type HeroGameIdEntry } from '../src/server/heroes/catalog/hero-game-ids.ts';

/** One row of `public.hero_game_roles`. */
export interface HeroGameRoleRow {
  gameId: number;
  baseGameId: number;
  role: string;
}

/**
 * What is wrong with `public.hero_game_roles` next to the live hero list (`hero_content`, by hero id)
 * and `hero-game-ids.json`; an empty list means the table is right. The migrations seed the table, so
 * it can drift from the roster the hero sync keeps current, and a wrong role there silently turns a
 * line-up or a trio into another one.
 *
 * Deadpool's base id has no row on purpose (the game reports his role forms), so it is never expected.
 */
export function compareHeroGameRoles(
  rows: readonly HeroGameRoleRow[],
  entries: readonly HeroGameIdEntry[],
  roleBySlug: ReadonlyMap<string, string>,
): string[] {
  const problems: string[] = [];
  const liveRoles = buildHeroRoleByGameId(entries, roleBySlug);
  const stored = new Map(rows.map((row) => [row.gameId, row]));
  const known = new Set<number>();

  for (const entry of entries) {
    const variants = entry.gameIdVariants ?? [];
    const ids = variants.length > 0 ? variants.map((variant) => variant.gameId) : [entry.gameId];

    for (const gameId of ids) {
      known.add(gameId);
      const expected = liveRoles.get(gameId);
      const row = stored.get(gameId);

      if (expected === undefined) {
        problems.push(`${entry.id} (${gameId}): the live hero list has no Vanguard, Duelist or Strategist role for it`);
      } else if (row === undefined) {
        problems.push(`${entry.id} (${gameId}): no row in hero_game_roles, expected ${expected}`);
      } else if (row.role !== expected) {
        problems.push(`${entry.id} (${gameId}): hero_game_roles says ${row.role}, the live hero list says ${expected}`);
      } else if (row.baseGameId !== entry.gameId) {
        problems.push(`${entry.id} (${gameId}): base id is ${row.baseGameId} in hero_game_roles, ${entry.gameId} in hero-game-ids.json`);
      }
    }
  }

  const entryIds = new Set(entries.map((entry) => entry.id));

  for (const slug of roleBySlug.keys()) {
    if (!entryIds.has(slug)) {
      problems.push(`${slug}: in the live hero list, but has no game id in hero-game-ids.json`);
    }
  }

  for (const gameId of stored.keys()) {
    if (!known.has(gameId)) {
      problems.push(`${gameId}: a row in hero_game_roles that no hero in hero-game-ids.json has`);
    }
  }

  return problems;
}
