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
  /** Null when the slot holds several abilities. */
  ability: string | null;
  /** Null unless every ability on the slot has the same tag. */
  tag: AbilityTag | null;
  /** Null unless every ability on the slot prints the same plain cooldown. */
  cooldownSeconds: number | null;
}

// A JSON import widens string unions to string; the spec checks every row of this table.
export const bundledHeroAbilityTagTable = bundledTable as unknown as HeroAbilityTagTable;

function slotOf(slot: string, rows: readonly HeroAbilityTagRow[]): HeroAbilitySlot {
  const names = new Set(rows.map((row) => row.ability));
  const tags = new Set(rows.map((row) => row.tag));
  const cooldowns = new Set(rows.map((row) => row.cooldown?.value ?? null));

  return {
    slot,
    ability: names.size === 1 ? rows[0].ability : null,
    tag: tags.size === 1 ? rows[0].tag : null,
    cooldownSeconds: cooldowns.size === 1 ? (rows[0].cooldown?.value ?? null) : null,
  };
}

/**
 * Each hero's slots by hero id. A key can hold several abilities (a team-up, a form, an upgrade) and
 * nothing says which one a count came from, so a slot is only as certain as all of them together. A
 * slot the hero's page does not list is absent, which is what makes a hero's unused slots drop out:
 * the overlay sends every slot, at 0 when the hero has no such ability.
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
