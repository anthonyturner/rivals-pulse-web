import type { HeroRole } from './hero.model';

/** Query parameters that hold the roster filters on `/heroes` and `/heroes/:heroId`. */
export const ROLE_QUERY_PARAM = 'role';
export const SEARCH_QUERY_PARAM = 'q';

const FILTERABLE_ROLES: readonly HeroRole[] = ['Vanguard', 'Duelist', 'Strategist'];

/** The role in a `role` query value (`vanguard`), or `All` for no value or one that names no role. */
export function parseRoleFilter(value: string | null): HeroRole | 'All' {
  const role = value?.toLowerCase();

  return FILTERABLE_ROLES.find((candidate) => candidate.toLowerCase() === role) ?? 'All';
}
