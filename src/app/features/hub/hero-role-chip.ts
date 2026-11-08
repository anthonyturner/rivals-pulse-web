import type { TileChip, TileChipKind } from './hub-tile.types';

/**
 * A role's chip is the role's own tint. The palette's role tokens are the secondary (Vanguard), the
 * tertiary (Duelist) and the accent (Strategist) colours, which are what the chip kinds draw with.
 */
export const HERO_ROLE_CHIP_KINDS = {
  Vanguard: 'secondary',
  Duelist: 'tertiary',
  Strategist: 'accent',
} as const satisfies Record<string, TileChipKind>;

const KIND_BY_ROLE: ReadonlyMap<string, TileChipKind> = new Map(Object.entries(HERO_ROLE_CHIP_KINDS));

/** The chip for a hero's role, or null for a hero with no role or a role of several. */
export function heroRoleChip(role: string | null): TileChip | null {
  const kind = role === null ? undefined : KIND_BY_ROLE.get(role);

  return role !== null && kind !== undefined ? { kind, label: role } : null;
}
