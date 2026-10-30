import type { Hero } from '../heroes/hero.model';

/** What a page knows about a hero besides its record. Missing for a hero the roster lacks. */
export interface HeroIdentity {
  name: string;
  role: string | null;
  imageUrl: string | null;
}

export type HeroIdentities = ReadonlyMap<string, HeroIdentity>;

/** A hero as a page draws it: always a name and a portrait, whether or not the roster knows the hero. */
export interface HeroCell {
  hero: string;
  name: string;
  role: string | null;
  imageUrl: string;
}

export function identitiesOf(heroes: readonly Pick<Hero, 'id' | 'name' | 'role' | 'imageUrl'>[]): HeroIdentities {
  return new Map(heroes.map((hero) => [hero.id, { name: hero.name, role: hero.role, imageUrl: hero.imageUrl }]));
}

export function heroCell(hero: string, identities: HeroIdentities): HeroCell {
  const identity = identities.get(hero);

  return {
    hero,
    name: identity?.name ?? titleCase(hero),
    role: identity?.role ?? null,
    imageUrl: identity?.imageUrl ?? `/images/heroes/${hero}.png`,
  };
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
