import bundledTable from './hero-ability-tags.table.json' with { type: 'json' };

export type AbilityTag = 'Utility' | 'Damage' | 'Mobility' | 'Sustain';

export interface HeroAbilityTagRow {
  ability: string;
  type: string;
  keys: string[];
  /** The upload slot its key feeds. Null for a key the overlay does not count, such as Left Click or Space. */
  slot: string | null;
  cooldown: { value: number; raw: string } | null;
  tag: AbilityTag | null;
  evidence?: { source: string; field: string; raw: string };
  reason?: string;
}

export interface HeroAbilityTagTable {
  sources: Record<string, { label: string; url: string; note: string }>;
  heroes: { heroId: string; name: string; abilities: HeroAbilityTagRow[] }[];
}

/** What one upload slot means for one hero. */
export interface HeroAbilitySlot {
  slot: string;
  /** The slot's base ability, or the one name every ability on it shares; null when neither exists. */
  ability: string | null;
  /** Every other name on the slot, such as the team-ups that replace the base ability; empty when none. */
  alsoIncludes: string[];
  /** The base ability's tag, or the tag every ability on the slot shares; null otherwise. */
  tag: AbilityTag | null;
  /** The base ability's plain cooldown, or the one every ability on the slot prints; null otherwise. */
  cooldownSeconds: number | null;
}

// A JSON import widens string unions to string; the spec checks every row of this table.
export const bundledHeroAbilityTagTable = bundledTable as unknown as HeroAbilityTagTable;

/** The row types that are the hero's own kit, as opposed to a team-up, a passive or a normal attack. */
const BASE_ABILITY_TYPES: ReadonlySet<string> = new Set(['Ability', 'Ultimate']);

// A team-up only replaces the base ability while its partner is on the team, so a count on a key is
// essentially its base abilities'. Only a key with no base ability is judged on its team-ups.
function slotOf(slot: string, rows: readonly HeroAbilityTagRow[]): HeroAbilitySlot {
  const bases = rows.filter((row) => BASE_ABILITY_TYPES.has(row.type));
  const deciding = bases.length > 0 ? bases : rows;
  const agreed = <T>(valueOf: (row: HeroAbilityTagRow) => T): T | null =>
    new Set(deciding.map(valueOf)).size === 1 ? valueOf(deciding[0]) : null;
  const ability = agreed((row) => row.ability);

  return {
    slot,
    ability,
    alsoIncludes: [...new Set(rows.map((row) => row.ability))].filter((name) => name !== ability),
    tag: agreed((row) => row.tag),
    cooldownSeconds: agreed((row) => row.cooldown?.value ?? null),
  };
}

/**
 * Each hero's slots by hero id. A key can hold several abilities (a team-up, a form, an upgrade), and
 * `slotOf` decides which one a count is named after. A slot the hero's page does not list is absent,
 * which is what makes a hero's unused slots drop out: the overlay sends every slot, at 0 when the
 * hero has no such ability.
 */
export function heroAbilitySlots(table: HeroAbilityTagTable = bundledHeroAbilityTagTable): ReadonlyMap<string, readonly HeroAbilitySlot[]> {
  return new Map(
    table.heroes.map((hero) => {
      const bySlot = new Map<string, HeroAbilityTagRow[]>();

      for (const row of hero.abilities) {
        if (row.slot !== null) {
          bySlot.set(row.slot, [...(bySlot.get(row.slot) ?? []), row]);
        }
      }

      return [hero.heroId, [...bySlot].map(([slot, rows]) => slotOf(slot, rows))];
    }),
  );
}
