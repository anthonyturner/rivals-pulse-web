/** What a page knows about a hero besides its record. Missing for a hero the roster lacks. */
export interface HeroIdentity {
  name: string;
  role: string | null;
  imageUrl: string | null;
}

export type HeroIdentities = ReadonlyMap<string, HeroIdentity>;

/** A hero as a stats row draws it. */
export interface HeroCellView {
  hero: string;
  name: string;
  role: string | null;
  imageUrl: string;
}

/** The identities of a roster, by hero id. */
export function heroIdentities(
  roster: readonly { id: string; name: string; role: string | null; imageUrl: string | null }[],
): HeroIdentities {
  return new Map(
    roster.map((hero) => [hero.id, { name: hero.name, role: hero.role, imageUrl: hero.imageUrl }]),
  );
}

/** A hero the roster does not know is still drawn, under its id spelled out, so a row is never dropped or blank. */
export function heroCell(hero: string, identities: HeroIdentities): HeroCellView {
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
