import { heroProgressRows } from './hero-progress';
import type { HeroIdentities } from '../hero-identity';

describe('heroProgressRows', () => {
  const identities: HeroIdentities = new Map();
  const minimums = { matches: 10, players: 2 };
  const rowOf = (appearances: number, players?: number) =>
    heroProgressRows([{ hero: 'hulk', appearances, players }], minimums, identities)[0];

  it('counts the appearances toward the match minimum while the hero is short of it', () => {
    expect(rowOf(4, 1)).toEqual(jasmine.objectContaining({ progressLabel: '4 of 10', progressPercent: 40 }));
  });

  it('counts the players once the hero has the appearances but too few players', () => {
    expect(rowOf(12, 1)).toEqual(jasmine.objectContaining({ progressLabel: '1 of 2 players', progressPercent: 50 }));
  });

  it('counts the appearances alone when no player minimum is stated, as in an older answer', () => {
    const [row] = heroProgressRows([{ hero: 'hulk', appearances: 12, players: 1 }], { matches: 10 }, identities);

    expect(row.progressLabel).toBe('12 of 10');
  });
});
