import { heroRoleChip } from './hero-role-chip';

describe('heroRoleChip', () => {
  it('tints Vanguard indigo, Duelist violet and Strategist yellow', () => {
    expect(heroRoleChip('Vanguard')).toEqual({ kind: 'secondary', label: 'Vanguard' });
    expect(heroRoleChip('Duelist')).toEqual({ kind: 'tertiary', label: 'Duelist' });
    expect(heroRoleChip('Strategist')).toEqual({ kind: 'accent', label: 'Strategist' });
  });

  it('gives no chip to a hero without a single role, rather than guessing a tint', () => {
    expect(heroRoleChip(null)).toBeNull();
    expect(heroRoleChip('Multi-Role')).toBeNull();
    expect(heroRoleChip('toString')).toBeNull();
  });
});
