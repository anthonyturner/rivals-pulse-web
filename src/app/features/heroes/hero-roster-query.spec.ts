import { parseRoleFilter } from './hero-roster-query';

describe('parseRoleFilter', () => {
  it('reads a role in any case', () => {
    expect(parseRoleFilter('vanguard')).toBe('Vanguard');
    expect(parseRoleFilter('Duelist')).toBe('Duelist');
    expect(parseRoleFilter('STRATEGIST')).toBe('Strategist');
  });

  it('means All for no value, an empty one, or one that names no role', () => {
    expect(parseRoleFilter(null)).toBe('All');
    expect(parseRoleFilter('')).toBe('All');
    expect(parseRoleFilter('tank')).toBe('All');
    expect(parseRoleFilter('multi-role')).toBe('All');
  });
});
