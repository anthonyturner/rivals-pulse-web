import officialSnapshot from '../../../../data/turso-cutover/106/external-sources-official-heroes.json';
import mobilityTable from '../../../app/features/heroes/hero-kit-mobility.table.json';
import { heroGameIdEntries } from '../../heroes/catalog/hero-game-ids';
import { bundledHeroAbilityTagTable as table, heroAbilitySlots, type HeroAbilityTagTable } from './hero-ability-tags';

interface OfficialAbility {
  name: string;
  type: string;
  description: string;
  technicalDetails?: { label: string; value: unknown }[];
}

const officialHeroes = (officialSnapshot as unknown as { heroes: { id: string; abilities: OfficialAbility[] }[] }).heroes;
const movementRows = (mobilityTable as unknown as { heroes: { heroId: string; abilities: { ability: string }[] }[] }).heroes;
const rows = table.heroes.flatMap((hero) => hero.abilities.map((row, index) => ({ heroId: hero.heroId, row, index })));
const KNOWN_SLOTS = ['ability_0', 'ability_1', 'ability_2', 'ability_3', 'team_up_0', 'ultimate'];

function officialOf(heroId: string, index: number): OfficialAbility {
  const hero = officialHeroes.find((candidate) => candidate.id === heroId);

  if (!hero) {
    throw new Error(`${heroId} is not in the official pages`);
  }

  return hero.abilities[index];
}

describe('the hero ability tag table', () => {
  it('has every ability of every hero on the official pages, in their order', () => {
    expect(table.heroes.map((hero) => hero.heroId)).toEqual(officialHeroes.map((hero) => hero.id));

    for (const hero of table.heroes) {
      expect(hero.abilities.map((row) => row.ability)).withContext(hero.heroId).toEqual(officialHeroes.find((one) => one.id === hero.heroId)?.abilities.map((one) => one.name) ?? []);
    }
  });

  it('covers every hero the game ids know', () => {
    const tagged = new Set(table.heroes.map((hero) => hero.heroId));

    expect(heroGameIdEntries.map((entry) => entry.id).filter((id) => !tagged.has(id))).toEqual([]);
  });

  it('gives each row a tag with a recorded source, or no tag with the reason', () => {
    for (const { heroId, row } of rows) {
      const where = `${heroId} ${row.ability}`;

      if (row.tag === null) {
        expect(row.reason).withContext(where).toBeTruthy();
        expect(row.evidence).withContext(where).toBeUndefined();
      } else {
        expect(['Utility', 'Damage', 'Mobility', 'Sustain']).withContext(where).toContain(row.tag);
        expect(Object.keys(table.sources)).withContext(where).toContain(row.evidence?.source ?? '');
        expect(row.reason).withContext(where).toBeUndefined();
      }
    }
  });

  it('holds evidence that really is in the source it names', () => {
    for (const { heroId, row, index } of rows) {
      const { evidence } = row;
      const official = officialOf(heroId, index);
      const where = `${heroId} ${row.ability}`;

      if (evidence?.source === 'hero-kit-mobility') {
        const listed = movementRows.find((hero) => hero.heroId === heroId)?.abilities.map((one) => one.ability.toLowerCase());

        expect(listed).withContext(where).toContain(row.ability.toLowerCase());
      } else if (evidence?.field === 'description') {
        expect(official.description).withContext(where).toContain(evidence.raw);
      } else if (evidence?.field === 'type') {
        expect(official.type).withContext(where).toBe(evidence.raw);
      } else if (evidence) {
        const printed = (official.technicalDetails ?? []).find((detail) => detail.label === evidence.field);

        expect(String(printed?.value)).withContext(where).toContain(evidence.raw);
      }
    }
  });

  it('takes each cooldown from the page, as a plain number of seconds only', () => {
    for (const { heroId, row, index } of rows.filter((one) => one.row.cooldown)) {
      const printed = officialOf(heroId, index).technicalDetails?.find((detail) => detail.label === 'Cooldown');

      expect(String(printed?.value)).withContext(`${heroId} ${row.ability}`).toBe(row.cooldown?.raw ?? '');
      expect(row.cooldown?.raw).withContext(`${heroId} ${row.ability}`).toMatch(/^\s*\d+(\.\d+)?\s*s?\s*$/i);
    }
  });

  it('names only the slots whose meaning is established, never ability_4 or team_up_1', () => {
    for (const { row } of rows) {
      if (row.slot !== null) {
        expect(KNOWN_SLOTS).toContain(row.slot);
      }
    }
  });

  it('never gives a normal attack the Utility tag', () => {
    expect(rows.filter(({ row }) => row.type === 'Normal Attack' && row.tag === 'Utility')).toEqual([]);
  });

  it('never tags as Utility an ability whose description names damage dealt', () => {
    const notDealt = /damage (?:boost|reduction|increase|taken|received|passing)|(?:incoming|absorbing|taking|you take|amplify|reducing) damage/gi;
    const named = rows
      .filter(({ row }) => row.tag === 'Utility')
      .filter(({ heroId, index }) => /damag/i.test(officialOf(heroId, index).description.replace(notDealt, '')))
      .map(({ heroId, row }) => `${heroId} ${row.ability}`);

    expect(named).toEqual([]);
  });

  it('leaves enough heroes with a measurable Utility ability for a ranking to exist', () => {
    const measurable = [...heroAbilitySlots().values()].filter((slots) =>
      slots.some((slot) => slot.tag === 'Utility' && slot.cooldownSeconds !== null && slot.slot !== 'ultimate'),
    );

    expect(measurable.length).toBeGreaterThanOrEqual(5);
  });
});

describe('heroAbilitySlots', () => {
  const row = (ability: string, slot: string | null, tag: 'Utility' | 'Damage' | null, cooldown: number | null) => ({
    ability,
    type: 'Ability',
    keys: [],
    slot,
    tag,
    cooldown: cooldown === null ? null : { value: cooldown, raw: `${cooldown}s` },
  });
  const slotsOf = (...abilities: ReturnType<typeof row>[]) => {
    const single: HeroAbilityTagTable = { sources: {}, heroes: [{ heroId: 'h', name: 'H', abilities }] };

    return heroAbilitySlots(single).get('h');
  };

  it('gives a slot with one ability that ability, tag and cooldown', () => {
    expect(slotsOf(row('Stun', 'ability_0', 'Utility', 10))).toEqual([{ slot: 'ability_0', ability: 'Stun', tag: 'Utility', cooldownSeconds: 10 }]);
  });

  it('keeps the tag and cooldown when every ability on the slot agrees, but names no one ability', () => {
    expect(slotsOf(row('Stun', 'ability_0', 'Utility', 10), row('Upgraded Stun', 'ability_0', 'Utility', 10))).toEqual([
      { slot: 'ability_0', ability: null, tag: 'Utility', cooldownSeconds: 10 },
    ]);
  });

  it('leaves a slot untagged when its abilities disagree, since a count cannot say which one it was', () => {
    expect(slotsOf(row('Stun', 'team_up_0', 'Utility', 10), row('Blast', 'team_up_0', 'Damage', 12))).toEqual([
      { slot: 'team_up_0', ability: null, tag: null, cooldownSeconds: null },
    ]);
  });

  it('has no slot for an ability on a key the overlay does not count', () => {
    expect(slotsOf(row('Jump', null, 'Utility', 4))).toEqual([]);
  });
});
