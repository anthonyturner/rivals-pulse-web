import { HERO_ROLES, type HeroRole } from '../../../contracts/role-stats.model.js';
import curatedHeroGameIds from '../../../../data/pulse-atlas/hero-game-ids.json' with { type: 'json' };

export interface HeroGameIdEntry {
  id: string;
  gameId: number;
  gameIdVariants?: readonly { gameId: number; role?: string }[];
}

/**
 * Game hero id to the hero's id in `heroes.json`. A hero the game splits by role (Deadpool) answers
 * to its base id and to every variant id, so all of them count as the one hero.
 */
function buildHeroSlugByGameId(entries: readonly HeroGameIdEntry[]): ReadonlyMap<number, string> {
  return new Map(
    entries.flatMap((entry): [number, string][] => [
      [entry.gameId, entry.id],
      ...(entry.gameIdVariants ?? []).map((variant): [number, string] => [variant.gameId, entry.id]),
    ]),
  );
}

/**
 * Game hero id to the hero's base game id: a hero the game splits by role (Deadpool) answers to its
 * base id from every variant id, as the published tier list does. A game id with no entry is absent.
 */
export function buildBaseGameIdByGameId(entries: readonly HeroGameIdEntry[]): ReadonlyMap<number, number> {
  return new Map(
    entries.flatMap((entry): [number, number][] => [
      [entry.gameId, entry.gameId],
      ...(entry.gameIdVariants ?? []).map((variant): [number, number] => [variant.gameId, entry.gameId]),
    ]),
  );
}

export const heroGameIdEntries: readonly HeroGameIdEntry[] = curatedHeroGameIds;

export const heroSlugByGameId: ReadonlyMap<number, string> = buildHeroSlugByGameId(heroGameIdEntries);

export const baseGameIdByGameId: ReadonlyMap<number, number> = buildBaseGameIdByGameId(heroGameIdEntries);

/**
 * Game hero id to the hero's role. A hero the game splits by role (Deadpool) has a role on each
 * variant id, so a match counts toward the role that was played; the base id and any variant with
 * no role of its own take the hero's role from `roleBySlug`. A game id whose role is unknown, or is
 * not one of the three roles, is left out.
 */
export function buildHeroRoleByGameId(
  entries: readonly HeroGameIdEntry[],
  roleBySlug: ReadonlyMap<string, string>,
): ReadonlyMap<number, HeroRole> {
  const roleOf = (value: string | undefined): HeroRole | undefined =>
    HERO_ROLES.find((role) => role === value);
  const result = new Map<number, HeroRole>();

  for (const entry of entries) {
    const heroRole = roleOf(roleBySlug.get(entry.id));

    if (heroRole !== undefined) {
      result.set(entry.gameId, heroRole);
    }

    for (const variant of entry.gameIdVariants ?? []) {
      const role = roleOf(variant.role) ?? heroRole;

      if (role !== undefined) {
        result.set(variant.gameId, role);
      }
    }
  }

  return result;
}
