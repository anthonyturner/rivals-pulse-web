import bundledTable from './hero-kit-mobility.table.json';

export type MobilitySpeedUnit = 'm/s' | 'bonus m/s' | 'bonus %';
export type MobilityAbilityKind = 'burst' | 'sustained' | 'extra-jump';

export interface SourcedValue<T> {
  value: T;
  /** The text exactly as the source prints it. */
  raw: string;
  /** A key of `HeroKitMobilityTable.sources`. */
  source: string;
  /** Where in the source the raw text sits, as `<section> > <label>`. */
  field: string;
  unit?: MobilitySpeedUnit;
  /** The source that gives the unit, where `raw` prints none. */
  unitSource?: string;
}

export interface HeroKitMobilityAbility {
  ability: string;
  kind: MobilityAbilityKind;
  distance: SourcedValue<number> | null;
  speed: SourcedValue<number> | null;
  cooldown: SourcedValue<number> | null;
  flight: SourcedValue<boolean> | null;
  note?: string;
}

export interface HeroKitMobilityHero {
  heroId: string;
  name: string;
  sourceUrl: string;
  baseSpeed: SourcedValue<number> | null;
  /** Set when the hero's normal way of moving is flight, not an ability they trigger. */
  movementModeFlight: SourcedValue<boolean> | null;
  abilities: HeroKitMobilityAbility[];
  note?: string;
  excluded?: { ability: string; reason: string }[];
}

export interface HeroKitMobilityTable {
  sources: Record<string, { label: string; url: string; checkedOn: string; note: string }>;
  heroes: HeroKitMobilityHero[];
}

export interface HeroKitMobilityCoverage {
  covered: number;
  total: number;
  missing: { heroId: string; fields: string[] }[];
}

// A JSON import widens string unions to string; the spec checks every cell of this table.
export const bundledHeroKitMobilityTable = bundledTable as unknown as HeroKitMobilityTable;

// The formula and the reasoning behind these numbers are in docs/hero-kit-mobility.md.
const BASE_POINTS_PER_METRE_PER_SECOND = 2;
const BURST_POINTS_CAP = 4;
const SUSTAINED_METRES_PER_SECOND_PER_POINT = 3;
const SUSTAINED_POINTS_CAP = 3;
const FLIGHT_MODE_POINTS = 3;
const FLIGHT_ABILITY_POINTS = 1;
const EXTRA_JUMP_POINTS = 0.25;
const NORMAL_BASE_SPEED = 6;

/** The table's fields a hero still lacks before the formula can score them. */
export function missingMobilityFields(hero: HeroKitMobilityHero): string[] {
  const missing = hero.baseSpeed ? [] : ['base speed'];

  for (const ability of hero.abilities) {
    if (ability.kind === 'burst') {
      if (!ability.distance) {
        missing.push(`${ability.ability}: distance`);
      }
      if (!ability.cooldown) {
        missing.push(`${ability.ability}: cooldown`);
      }
    } else if (ability.kind === 'sustained' && !ability.speed) {
      missing.push(`${ability.ability}: speed`);
    }
  }

  return missing;
}

/** The 1 to 10 score, or null while any value the formula needs is missing. */
export function heroKitMobilityScore(hero: HeroKitMobilityHero): number | null {
  if (!hero.baseSpeed || missingMobilityFields(hero).length > 0) {
    return null;
  }

  const baseSpeed = hero.baseSpeed.value;
  const points =
    (baseSpeed - NORMAL_BASE_SPEED) * BASE_POINTS_PER_METRE_PER_SECOND +
    burstPoints(hero.abilities) +
    sustainedPoints(hero.abilities, baseSpeed) +
    flightPoints(hero) +
    hero.abilities.filter(({ kind }) => kind === 'extra-jump').length * EXTRA_JUMP_POINTS;

  return Math.min(10, Math.max(1, Math.round(1 + points)));
}

export function heroKitMobilityCoverage(
  table: HeroKitMobilityTable = bundledHeroKitMobilityTable,
): HeroKitMobilityCoverage {
  const missing = table.heroes
    .map((hero) => ({ heroId: hero.heroId, fields: missingMobilityFields(hero) }))
    .filter(({ fields }) => fields.length > 0);

  return { covered: table.heroes.length - missing.length, total: table.heroes.length, missing };
}

/**
 * Every hero's score once the table covers them all, and null until then, so
 * that a reader keeps today's values rather than mixing two scales.
 */
export function publishableHeroKitMobilityScores(
  table: HeroKitMobilityTable = bundledHeroKitMobilityTable,
): ReadonlyMap<string, number> | null {
  if (heroKitMobilityCoverage(table).missing.length > 0) {
    return null;
  }

  return new Map(table.heroes.map((hero) => [hero.heroId, heroKitMobilityScore(hero) as number]));
}

function burstPoints(abilities: HeroKitMobilityAbility[]): number {
  const metresPerCooldownSecond = abilities.reduce(
    (sum, { kind, distance, cooldown }) =>
      kind === 'burst' && distance && cooldown ? sum + distance.value / cooldown.value : sum,
    0,
  );

  return Math.min(BURST_POINTS_CAP, metresPerCooldownSecond);
}

function sustainedPoints(abilities: HeroKitMobilityAbility[], baseSpeed: number): number {
  const fastest = abilities.reduce(
    (best, { kind, speed }) =>
      kind === 'sustained' && speed ? Math.max(best, effectiveSpeed(speed, baseSpeed)) : best,
    baseSpeed,
  );

  return Math.min(SUSTAINED_POINTS_CAP, (fastest - baseSpeed) / SUSTAINED_METRES_PER_SECOND_PER_POINT);
}

function effectiveSpeed(speed: SourcedValue<number>, baseSpeed: number): number {
  switch (speed.unit) {
    case 'bonus m/s':
      return baseSpeed + speed.value;
    case 'bonus %':
      return baseSpeed * (1 + speed.value / 100);
    default:
      return speed.value;
  }
}

function flightPoints(hero: HeroKitMobilityHero): number {
  if (hero.movementModeFlight) {
    return FLIGHT_MODE_POINTS;
  }

  return hero.abilities.some(({ flight }) => flight) ? FLIGHT_ABILITY_POINTS : 0;
}
