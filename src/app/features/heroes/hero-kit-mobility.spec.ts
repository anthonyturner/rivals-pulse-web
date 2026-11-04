import heroSeeds from '../../../../data/seeds/heroes.mock.json';
import officialSnapshot from '../../../../data/turso-cutover/106/external-sources-official-heroes.json';
import {
  bundledHeroKitMobilityTable as table,
  heroKitMobilityCoverage,
  heroKitMobilityScore,
  missingMobilityFields,
  publishableHeroKitMobilityScores,
  type HeroKitMobilityAbility,
  type HeroKitMobilityHero,
  type SourcedValue,
} from './hero-kit-mobility';

interface OfficialDetail {
  label: string;
  value: unknown;
}
interface OfficialAbility {
  name: string;
  type: string;
  description: string;
  technicalDetails?: OfficialDetail[];
}
interface OfficialHero {
  id: string;
  abilities: OfficialAbility[];
  baseStats: OfficialDetail[];
  baseStatKits: { label: string; stats: OfficialDetail[] }[];
}

const officialHeroes = (officialSnapshot as unknown as { heroes: OfficialHero[] }).heroes;
const seeds = heroSeeds as unknown as { id: string; overview?: string }[];

function sourced<T>(value: T, unit?: SourcedValue<T>['unit']): SourcedValue<T> {
  return { value, raw: String(value), source: 'official-kit', field: 'Test > Value', ...(unit ? { unit } : {}) };
}

function hero(overrides: Partial<HeroKitMobilityHero> = {}): HeroKitMobilityHero {
  return {
    heroId: 'test-hero',
    name: 'Test Hero',
    sourceUrl: 'https://www.marvelrivals.com/test.html',
    baseSpeed: sourced(6),
    movementModeFlight: null,
    abilities: [],
    ...overrides,
  };
}

function ability(overrides: Partial<HeroKitMobilityAbility>): HeroKitMobilityAbility {
  return { ability: 'Test', kind: 'burst', distance: null, speed: null, cooldown: null, flight: null, ...overrides };
}

const burst = (distance: number, cooldown: number) =>
  ability({ distance: sourced(distance), cooldown: sourced(cooldown) });
const sustained = (speed: number, unit: 'm/s' | 'bonus m/s' | 'bonus %' = 'm/s') =>
  ability({ kind: 'sustained', speed: sourced(speed, unit) });

describe('hero kit mobility table', () => {
  const officialFor = (heroId: string) => officialHeroes.find(({ id }) => id === heroId) as OfficialHero;
  const rowOf = (heroId: string) => table.heroes.find((row) => row.heroId === heroId) as HeroKitMobilityHero;
  const numberCells = (row: HeroKitMobilityAbility) =>
    [row.distance, row.speed, row.cooldown].filter((cell): cell is SourcedValue<number> => cell !== null);
  const numbersIn = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

  it('has one row for every hero on the official site', () => {
    expect(table.heroes.map(({ heroId }) => heroId).sort()).toEqual(officialHeroes.map(({ id }) => id).sort());
  });

  it('copies every ability value verbatim from the official kit, under the label it names', () => {
    for (const row of table.heroes) {
      for (const entry of row.abilities) {
        for (const cell of numberCells(entry)) {
          const label = cell.field.slice(`${entry.ability} > `.length);
          const printed = officialFor(row.heroId)
            .abilities.filter(({ name }) => name === entry.ability)
            .flatMap(({ technicalDetails }) => technicalDetails ?? [])
            .filter((detail) => detail.label === label)
            .map(({ value }) => String(value));

          expect(cell.source).withContext(cell.field).toBe('official-kit');
          expect(printed).withContext(`${row.heroId}: ${cell.field}`).toContain(cell.raw);
          expect(numbersIn(cell.raw)).withContext(`${row.heroId}: ${cell.field}`).toContain(cell.value);
        }
      }
    }
  });

  it('takes each column from text in that column\'s unit', () => {
    for (const row of table.heroes) {
      for (const { distance, speed, cooldown } of row.abilities) {
        if (distance) {
          expect(distance.raw).withContext(`${row.heroId}: ${distance.field}`).toMatch(/\d\s*m(?!\/)/);
        }
        if (speed) {
          expect(speed.raw).withContext(`${row.heroId}: ${speed.field}`).toMatch(/m\/s|%/);
        }
        if (cooldown) {
          expect(cooldown.raw).withContext(`${row.heroId}: ${cooldown.field}`).toMatch(/\d\s*s\b/);
        }
      }
    }
  });

  it('copies every base speed verbatim, and sources the unit when the kit prints none', () => {
    for (const row of table.heroes) {
      const cell = row.baseSpeed as SourcedValue<number>;
      const kit = officialFor(row.heroId).baseStatKits.find(({ label }) => cell.field === `${label} > Movement Speed`);
      const printed = kit?.stats.find(({ label }) => label === 'Movement Speed')?.value;

      expect(printed).withContext(row.heroId).toBe(cell.raw);

      if (cell.raw.includes('m/s')) {
        expect(cell.raw).withContext(row.heroId).toContain(String(cell.value));
      } else {
        expect(cell.raw).withContext(row.heroId).toBe(String(cell.value * 100));
        expect(table.sources[cell.unitSource as string]).withContext(row.heroId).toBeDefined();
      }
    }
  });

  it('quotes every flight claim from its source', () => {
    for (const row of table.heroes) {
      const official = officialFor(row.heroId);

      for (const entry of row.abilities.filter(({ flight }) => flight)) {
        const quote = (entry.flight as SourcedValue<boolean>).raw;
        const described = official.abilities.some(
          ({ name, description }) => name === entry.ability && description.includes(quote),
        );

        expect(described).withContext(`${row.heroId}: ${quote}`).toBeTrue();
      }

      const mode = row.movementModeFlight;
      if (mode?.source === 'official-kit') {
        expect(official.baseStats.some(({ label, value }) => label === 'Movement Mode' && value === mode.raw))
          .withContext(row.heroId)
          .toBeTrue();
      } else if (mode) {
        expect(seeds.find(({ id }) => id === row.heroId)?.overview).withContext(row.heroId).toContain(mode.raw);
      }
    }
  });

  it('names a known source for every value', () => {
    for (const row of table.heroes) {
      expect(row.sourceUrl).toMatch(/^https:\/\/www\.marvelrivals\.com\//);

      const cells = [
        row.baseSpeed,
        row.movementModeFlight,
        ...row.abilities.flatMap(({ distance, speed, cooldown, flight, jumps }) => [
          distance,
          speed,
          cooldown,
          flight,
          jumps ?? null,
        ]),
      ];
      for (const cell of cells) {
        if (cell) {
          expect(table.sources[cell.source]).withContext(cell.field).toBeDefined();
        }
      }
    }
  });

  it('counts no projectile speed, attack range or boost given to allies as the hero moving', () => {
    const notTheHeroMoving = /projectile|attack range|attack speed|\(ally\)|hook speed|hook length|webbing length/i;

    for (const row of table.heroes) {
      for (const cell of row.abilities.flatMap(numberCells)) {
        expect(cell.field).withContext(row.heroId).not.toMatch(notTheHeroMoving);
      }
    }
  });

  it('quotes the jump count from the source', () => {
    const jumpWords: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four' };

    for (const row of table.heroes) {
      for (const { ability: name, jumps } of row.abilities) {
        if (jumps) {
          const described = officialFor(row.heroId).abilities.some(
            (entry) => entry.name === name && entry.description.includes(jumps.raw),
          );

          expect(described).withContext(`${row.heroId}: ${jumps.raw}`).toBeTrue();
          expect(jumps.raw).withContext(row.heroId).toContain(jumpWords[jumps.value]);
        }
      }
    }
  });

  it('gives the scores the documented formula works out for real heroes', () => {
    const scores = Object.fromEntries(
      ['groot', 'iron-man', 'storm', 'iron-fist', 'black-panther', 'captain-america', 'peni-parker'].map((heroId) => [
        heroId,
        heroKitMobilityScore(rowOf(heroId)),
      ]),
    );

    expect(scores).toEqual({
      groot: 1,
      'iron-man': 6,
      storm: 5,
      'iron-fist': 4,
      'black-panther': 8,
      'captain-america': 5,
      'peni-parker': 6,
    });
  });

  it('takes rows only from the regular kit, not ultimates, team-ups or normal attacks', () => {
    for (const row of table.heroes) {
      for (const entry of row.abilities) {
        const types = officialFor(row.heroId)
          .abilities.filter(({ name }) => name === entry.ability)
          .map(({ type }) => type);

        expect(types.some((type) => type === 'Ability' || type === 'Passive'))
          .withContext(`${row.heroId}: ${entry.ability}`)
          .toBeTrue();
      }
    }
  });

  it('leaves a value empty when the source gives no number, and does not score that hero', () => {
    expect(missingMobilityFields(rowOf('hulk'))).toEqual(['Incredible Leap: distance', 'Incredible Leap: cooldown']);
    expect(heroKitMobilityScore(rowOf('hulk'))).toBeNull();
  });

  it('scores flying heroes above a hero with no movement kit', () => {
    const groot = heroKitMobilityScore(rowOf('groot')) as number;

    expect(heroKitMobilityScore(rowOf('iron-man'))).toBeGreaterThan(groot);
    expect(heroKitMobilityScore(rowOf('storm'))).toBeGreaterThan(groot);
  });
});

describe('heroKitMobilityScore', () => {
  it('gives a normal-speed hero with no movement kit the lowest score', () => {
    expect(heroKitMobilityScore(hero())).toBe(1);
  });

  it('adds two points per metre per second of base speed above normal', () => {
    expect(heroKitMobilityScore(hero({ baseSpeed: sourced(7) }))).toBe(3);
  });

  it('adds burst distance per second of cooldown across abilities', () => {
    expect(heroKitMobilityScore(hero({ abilities: [burst(10, 10), burst(20, 10)] }))).toBe(4);
  });

  it('caps burst points so one short-cooldown ability cannot decide the score', () => {
    expect(heroKitMobilityScore(hero({ abilities: [burst(30, 3)] }))).toBe(5);
  });

  it('uses only the fastest sustained movement, since a hero moves one way at a time', () => {
    expect(heroKitMobilityScore(hero({ abilities: [sustained(9), sustained(12)] }))).toBe(3);
  });

  it('turns a bonus in m/s or percent into a speed on top of the base speed', () => {
    expect(heroKitMobilityScore(hero({ abilities: [sustained(6, 'bonus m/s')] }))).toBe(3);
    expect(heroKitMobilityScore(hero({ abilities: [sustained(100, 'bonus %')] }))).toBe(3);
  });

  it('adds three points for flying as the normal way of moving, and one for an ability that flies', () => {
    expect(heroKitMobilityScore(hero({ movementModeFlight: sourced(true) }))).toBe(4);
    expect(heroKitMobilityScore(hero({ abilities: [{ ...burst(0, 10), flight: sourced(true) }] }))).toBe(2);
  });

  it('does not add the flight points together', () => {
    const flyingAbility = { ...burst(0, 10), flight: sourced(true) };

    expect(heroKitMobilityScore(hero({ movementModeFlight: sourced(true), abilities: [flyingAbility] }))).toBe(4);
  });

  it('ignores a flight value of false', () => {
    const notFlying = { ...burst(0, 10), flight: sourced(false) };

    expect(heroKitMobilityScore(hero({ movementModeFlight: sourced(false), abilities: [notFlying] }))).toBe(1);
  });

  it('adds a quarter point per extra jump, with no numbers needed', () => {
    const jumps = Array.from({ length: 12 }, () => ability({ kind: 'extra-jump' }));

    expect(missingMobilityFields(hero({ abilities: jumps }))).toEqual([]);
    expect(heroKitMobilityScore(hero({ abilities: jumps }))).toBe(4);
  });

  it('counts each jump on a row that gives several', () => {
    const row = ability({ kind: 'extra-jump', jumps: sourced(12) });

    expect(heroKitMobilityScore(hero({ abilities: [row] }))).toBe(4);
  });

  it('caps sustained points at three', () => {
    expect(heroKitMobilityScore(hero({ abilities: [sustained(30)] }))).toBe(4);
  });

  it('keeps the score at or above one', () => {
    expect(heroKitMobilityScore(hero({ baseSpeed: sourced(4) }))).toBe(1);
  });

  it('keeps the score at or below ten', () => {
    expect(
      heroKitMobilityScore(
        hero({
          baseSpeed: sourced(9),
          movementModeFlight: sourced(true),
          abilities: [burst(40, 2), sustained(30)],
        }),
      ),
    ).toBe(10);
  });

  it('does not score a hero with a missing value, rather than treating it as zero', () => {
    expect(heroKitMobilityScore(hero({ baseSpeed: null }))).toBeNull();
    expect(heroKitMobilityScore(hero({ abilities: [ability({ ability: 'Leap', cooldown: sourced(5) })] }))).toBeNull();
    expect(heroKitMobilityScore(hero({ abilities: [ability({ kind: 'sustained' })] }))).toBeNull();
  });

  it('names exactly which fields are missing', () => {
    expect(
      missingMobilityFields(
        hero({
          baseSpeed: null,
          abilities: [ability({ ability: 'Leap' }), ability({ ability: 'Crawl', kind: 'sustained' })],
        }),
      ),
    ).toEqual(['base speed', 'Leap: distance', 'Leap: cooldown', 'Crawl: speed']);
  });
});

describe('publishableHeroKitMobilityScores', () => {
  const sources = table.sources;

  it("publishes nothing while any hero is missing a value, so today's values stay on the site", () => {
    const partial = { sources, heroes: [hero({ heroId: 'a' }), hero({ heroId: 'b', baseSpeed: null })] };

    expect(publishableHeroKitMobilityScores(partial)).toBeNull();
    expect(heroKitMobilityCoverage(partial)).toEqual({
      covered: 1,
      total: 2,
      missing: [{ heroId: 'b', fields: ['base speed'] }],
    });
  });

  it('publishes every hero once the table covers them all', () => {
    const complete = { sources, heroes: [hero({ heroId: 'a' }), hero({ heroId: 'b', baseSpeed: sourced(7) })] };

    expect(publishableHeroKitMobilityScores(complete)).toEqual(
      new Map([
        ['a', 1],
        ['b', 3],
      ]),
    );
  });

  it("agrees with the bundled table's coverage", () => {
    const { missing, total } = heroKitMobilityCoverage();

    expect(total).toBe(table.heroes.length);
    expect(publishableHeroKitMobilityScores() === null).toBe(missing.length > 0);
  });
});
