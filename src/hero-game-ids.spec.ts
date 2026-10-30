import { buildHeroRoleByGameId, heroGameIdEntries, type HeroGameIdEntry } from './hero-game-ids';

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
