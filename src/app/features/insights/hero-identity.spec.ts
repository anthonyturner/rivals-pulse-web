import { roleKeyOf } from './hero-identity';

describe('roleKeyOf', () => {
  it('writes a role as a lower-case style key', () => {
    expect(roleKeyOf('Vanguard')).toBe('vanguard');
    expect(roleKeyOf(' Multi-Role ')).toBe('multi-role');
  });

  it('is null for a hero with no role, so nothing is tinted by a guess', () => {
    expect(roleKeyOf(null)).toBeNull();
    expect(roleKeyOf('  ')).toBeNull();
  });
});
