import {
  buildBaseGameIdByGameId,
  buildHeroPlacementByGameId,
  buildHeroRoleByGameId,
  heroGameIdEntries,
  type HeroGameIdEntry,
} from './hero-game-ids';

const ENTRIES: HeroGameIdEntry[] = [
  { id: 'hulk', gameId: 1011 },
  { id: 'black-widow', gameId: 1033 },
  {
    id: 'deadpool',
    gameId: 1057,
    gameIdVariants: [
      { gameId: 10571, role: 'Vanguard' },
      { gameId: 10572, role: 'Duelist' },
      { gameId: 10573 },
    ],
  },
  { id: 'mystery', gameId: 1999 },
  { id: 'odd', gameId: 1998 },
];
const ROLES = new Map([
  ['hulk', 'Vanguard'],
  ['black-widow', 'Duelist'],
  ['deadpool', 'Strategist'],
  ['odd', 'Healer'],
]);

describe('buildBaseGameIdByGameId', () => {
  const bases = buildBaseGameIdByGameId(ENTRIES);

  it('maps a hero to its own id and every role form of Deadpool to his base id', () => {
    expect(bases.get(1011)).toBe(1011);
    expect(bases.get(1057)).toBe(1057);
    expect([10571, 10572, 10573].map((gameId) => bases.get(gameId))).toEqual([1057, 1057, 1057]);
  });

  it('has no entry for a game id that belongs to no hero', () => {
    expect(bases.has(0)).toBeFalse();
  });
});

describe('buildHeroPlacementByGameId', () => {
  const placements = buildHeroPlacementByGameId(ENTRIES);

  it('names a hero by its id and gives it no role', () => {
    expect(placements.get(1011)).toEqual({ hero: 'hulk' });
    expect(placements.get(1057)).toEqual({ hero: 'deadpool' });
  });

  it("gives each of Deadpool's role forms the role it is played in", () => {
    expect(placements.get(10571)).toEqual({ hero: 'deadpool', role: 'Vanguard' });
    expect(placements.get(10572)).toEqual({ hero: 'deadpool', role: 'Duelist' });
  });

  it('gives a variant with no role of its own no role, rather than its hero', () => {
    expect(placements.get(10573)).toEqual({ hero: 'deadpool', role: undefined });
  });

  it('has no entry for a game id that belongs to no hero', () => {
    expect(placements.has(0)).toBeFalse();
  });

  it("covers Deadpool's three curated forms with a role each", () => {
    const curated = buildHeroPlacementByGameId(heroGameIdEntries);

    expect([10571, 10572, 10573].map((gameId) => curated.get(gameId))).toEqual([
      { hero: 'deadpool', role: 'Vanguard' },
      { hero: 'deadpool', role: 'Duelist' },
      { hero: 'deadpool', role: 'Strategist' },
    ]);
    expect(curated.get(1057)).toEqual({ hero: 'deadpool' });
  });
});

describe('buildHeroRoleByGameId', () => {
  const roles = buildHeroRoleByGameId(ENTRIES, ROLES);

  it("gives a hero its stored role", () => {
    expect(roles.get(1011)).toBe('Vanguard');
    expect(roles.get(1033)).toBe('Duelist');
  });

  it("gives a hero the game splits by role the role of the id that was played, not the hero's own", () => {
    expect(roles.get(10571)).toBe('Vanguard');
    expect(roles.get(10572)).toBe('Duelist');
    expect(roles.get(1057)).toBe('Strategist');
  });

  it("falls back to the hero's role for a variant with no role of its own", () => {
    expect(roles.get(10573)).toBe('Strategist');
  });

  it('leaves out a game id whose hero has no role, or a role that is not one of the three', () => {
    expect(roles.has(1999)).toBeFalse();
    expect(roles.has(1998)).toBeFalse();
  });

  it('covers every curated variant with a role of its own', () => {
    const variants = heroGameIdEntries.flatMap((entry) => entry.gameIdVariants ?? []);

    expect(variants.length).toBeGreaterThan(0);
    expect(variants.every((variant) => variant.role !== undefined)).toBeTrue();
  });
});
