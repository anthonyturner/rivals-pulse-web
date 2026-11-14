import officialSnapshot from '../../../../data/turso-cutover/106/external-sources-official-heroes.json';
import mobilityTable from '../../../app/features/heroes/hero-kit-mobility.table.json';
import { heroGameIdEntries } from '../../heroes/catalog/hero-game-ids';
import { bundledHeroAbilityTagTable as table, heroAbilitySlots, type HeroAbilityTagRow, type HeroAbilityTagTable } from './hero-ability-tags';

interface OfficialAbility {
  name: string;
  type: string;
  description: string;
  technicalDetails?: { label: string; value: unknown }[];
}

const officialHeroes = (officialSnapshot as unknown as { heroes: { id: string; abilities: OfficialAbility[] }[] }).heroes;
const movementRows = (mobilityTable as unknown as { heroes: { heroId: string; abilities: { ability: string }[] }[] }).heroes;
const KNOWN_SLOTS = ['ability_0', 'ability_1', 'ability_2', 'ability_3', 'team_up_0', 'ultimate'];

function officialAbilitiesOf(heroId: string): OfficialAbility[] {
  const hero = officialHeroes.find((candidate) => candidate.id === heroId);

  if (!hero) {
    throw new Error(`${heroId} is not in the official pages`);
  }

  return hero.abilities;
}

/** The page's abilities in order, each with its row, or with no row when the table dropped it as a repeat. */
function pairedAbilities(heroId: string, abilities: readonly HeroAbilityTagRow[]): { official: OfficialAbility; row: HeroAbilityTagRow | null }[] {
  let next = 0;

  return officialAbilitiesOf(heroId).map((official) => {
    const row = abilities[next]?.ability === official.name ? abilities[next++] : null;

    return { official, row };
  });
}

const keysOf = (ability: OfficialAbility) => (ability.technicalDetails ?? []).filter((detail) => detail.label === 'Key').map((detail) => String(detail.value));
const cooldownTextOf = (ability: OfficialAbility) => (ability.technicalDetails ?? []).find((detail) => detail.label === 'Cooldown')?.value;
const pairs = table.heroes.flatMap((hero) => pairedAbilities(hero.heroId, hero.abilities).map((pair) => ({ heroId: hero.heroId, ...pair })));
const rows = pairs.flatMap(({ heroId, official, row }) => (row ? [{ heroId, official, row }] : []));

describe('the hero ability tag table', () => {
  it('has every ability of every hero on the official pages, in their order', () => {
    expect(table.heroes.map((hero) => hero.heroId)).toEqual(officialHeroes.map((hero) => hero.id));

    for (const hero of table.heroes) {
      expect(pairedAbilities(hero.heroId, hero.abilities).filter(({ row }) => row).length).withContext(hero.heroId).toBe(hero.abilities.length);
    }
  });

  it('leaves out only an ability the page prints again with the same name, type, keys and cooldown', () => {
    const dropped = pairs.filter(({ row }) => row === null);

    for (const { heroId, official } of dropped) {
      const kept = rows.find((one) => one.heroId === heroId && one.row.ability === official.name)?.official;

      expect(kept && [kept.type, keysOf(kept).join(), cooldownTextOf(kept)]).withContext(`${heroId} ${official.name}`).toEqual([official.type, keysOf(official).join(), cooldownTextOf(official)]);
    }

    expect(dropped.find(({ heroId, official }) => heroId === 'doctor-strange' && official.name === 'PSIONIC VORTEX')).toBeDefined();
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
    for (const { heroId, row, official } of rows) {
      const { evidence } = row;
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
    for (const { heroId, row, official } of rows.filter((one) => one.row.cooldown)) {
      const printed = official.technicalDetails?.find((detail) => detail.label === 'Cooldown');

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
      .filter(({ official }) => /damag/i.test(official.description.replace(notDealt, '')))
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
  const row = (ability: string, slot: string | null, tag: 'Utility' | 'Damage' | null, cooldown: number | null, type = 'Ability') => ({
    ability,
    type,
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
    expect(slotsOf(row('Stun', 'ability_0', 'Utility', 10))).toEqual([
      { slot: 'ability_0', ability: 'Stun', alsoIncludes: [], tag: 'Utility', cooldownSeconds: 10 },
    ]);
  });

  it('names a slot after its one base ability and lists its team-up variants once each', () => {
    expect(
      slotsOf(
        row('Maelstrom of Madness', 'ability_2', 'Damage', 6),
        row('PSIONIC VORTEX', 'ability_2', null, 6, 'Team-Up Ability'),
        row('GAMMA MAELSTROM', 'ability_2', 'Utility', 8, 'Team-Up Ability'),
        row('PSIONIC VORTEX', 'ability_2', null, 6, 'Team-Up Ability'),
      ),
    ).toEqual([
      { slot: 'ability_2', ability: 'Maelstrom of Madness', alsoIncludes: ['PSIONIC VORTEX', 'GAMMA MAELSTROM'], tag: 'Damage', cooldownSeconds: 6 },
    ]);
  });

  it('takes the base ultimate on the ultimate slot over a team-up sharing its key', () => {
    expect(slotsOf(row('Big One', 'ultimate', 'Damage', null, 'Ultimate'), row('Duo Strike', 'ultimate', 'Utility', 30, 'Team-Up Ability'))).toEqual([
      { slot: 'ultimate', ability: 'Big One', alsoIncludes: ['Duo Strike'], tag: 'Damage', cooldownSeconds: null },
    ]);
  });

  it('keeps the tag and cooldown when two base abilities on the slot agree, but names no one ability', () => {
    expect(slotsOf(row('Stun', 'ability_0', 'Utility', 10), row('Upgraded Stun', 'ability_0', 'Utility', 10))).toEqual([
      { slot: 'ability_0', ability: null, alsoIncludes: ['Stun', 'Upgraded Stun'], tag: 'Utility', cooldownSeconds: 10 },
    ]);
  });

  it('leaves a slot of two base abilities untagged when they disagree, since a count cannot say which one it was', () => {
    expect(slotsOf(row('Stun', 'ability_1', 'Utility', 10), row('Blast', 'ability_1', 'Damage', 12), row('Duo', 'ability_1', null, 12, 'Team-Up Ability'))).toEqual([
      { slot: 'ability_1', ability: null, alsoIncludes: ['Stun', 'Blast', 'Duo'], tag: null, cooldownSeconds: null },
    ]);
  });

  it('names a slot of two same-named base abilities even when a team-up shares the key', () => {
    expect(slotsOf(row('Gamma Burst', 'ability_2', 'Damage', 8), row('Gamma Burst', 'ability_2', 'Damage', 8), row('Duo', 'ability_2', 'Utility', 20, 'Team-Up Ability'))).toEqual([
      { slot: 'ability_2', ability: 'Gamma Burst', alsoIncludes: ['Duo'], tag: 'Damage', cooldownSeconds: 8 },
    ]);
  });

  it('judges a slot of team-ups alone by all of them together', () => {
    expect(slotsOf(row('Duo', 'team_up_0', 'Utility', 10, 'Team-Up Ability'), row('Trio', 'team_up_0', 'Damage', 10, 'Team-Up Ability'))).toEqual([
      { slot: 'team_up_0', ability: null, alsoIncludes: ['Duo', 'Trio'], tag: null, cooldownSeconds: 10 },
    ]);
  });

  it('has no slot for an ability on a key the overlay does not count', () => {
    expect(slotsOf(row('Jump', null, 'Utility', 4))).toEqual([]);
  });
});

describe('the bundled slots', () => {
  it("name Doctor Strange's E after Maelstrom of Madness and list its team-ups", () => {
    expect(heroAbilitySlots().get('doctor-strange')?.find((slot) => slot.slot === 'ability_2')).toEqual({
      slot: 'ability_2',
      ability: 'Maelstrom of Madness',
      alsoIncludes: ['PSIONIC VORTEX', 'GAMMA MAELSTROM'],
      tag: 'Damage',
      cooldownSeconds: 6,
    });
  });
});
