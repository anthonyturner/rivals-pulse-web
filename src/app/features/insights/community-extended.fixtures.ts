import type {
  CommunityFigures,
  CommunityHeroFigures,
  CommunityPerMinute,
  CommunityRoleFigures,
} from '../../../contracts/community-figures.model';
import type { CommunityKillPair, CommunityKills } from '../../../contracts/community-kills.model';
import { HERO_ROLES } from '../../../contracts/role-stats.model';
import { season } from './hero-matchup.fixtures';

/** Fixtures the extended-stats specs share; nothing imports this outside a spec. */

const NO_FIGURES: CommunityPerMinute = { damage: null, healing: null, blocked: null };

export function perMinuteOf(figures: Partial<CommunityPerMinute> = {}): CommunityPerMinute {
  return { ...NO_FIGURES, ...figures };
}

/** The blend and every other mode, each holding the same roles and heroes unless `others` says otherwise. */
export function figuresOf(
  roles: Partial<Record<(typeof HERO_ROLES)[number], Partial<CommunityPerMinute>>>,
  heroes: CommunityHeroFigures[] = [],
  overrides: Partial<CommunityFigures> = {},
  otherModes: Partial<Record<string, { roles: CommunityRoleFigures[]; heroes: CommunityHeroFigures[] }>> = {},
): CommunityFigures {
  const roleList = (): CommunityRoleFigures[] =>
    HERO_ROLES.map((role) => ({ role, ...NO_FIGURES, ...(roles[role] ?? {}) }));
  const modes = [
    ['all', 'Quick Match and Competitive'],
    ['quick-match', 'Quick Match'],
    ['competitive', 'Competitive'],
    ['arcade', 'Arcade'],
    ['practice', 'Practice'],
  ] as const;

  return {
    status: 'ready',
    minimums: { roleLines: 50, heroLines: 10, recorders: 3 },
    halfSeasons: [season(10.5)],
    halfSeason: season(10.5),
    inPlaceOf: null,
    modes: modes.map(([id, label]) => ({
      id,
      label,
      roles: otherModes[id]?.roles ?? (id === 'all' ? roleList() : HERO_ROLES.map((role) => ({ role, ...NO_FIGURES }))),
      heroes: otherModes[id]?.heroes ?? (id === 'all' ? heroes : []),
    })),
    ...overrides,
  };
}

export function emptyFigures(): CommunityFigures {
  return figuresOf({}, [], { status: 'not-enough-data' });
}

export function heroFigures(hero: string, figures: Partial<CommunityPerMinute>): CommunityHeroFigures {
  return { hero, ...NO_FIGURES, ...figures };
}

export function killPair(killer: string, victim: string, killsBand = 25): CommunityKillPair {
  return { killer, victim, killsBand };
}

export function killsOf(pairs: CommunityKillPair[], overrides: Partial<CommunityKills> = {}): CommunityKills {
  return {
    status: pairs.length > 0 ? 'ready' : 'not-enough-data',
    minimums: { pairMatches: 10, recorders: 3 },
    halfSeasons: [season(10.5)],
    halfSeason: season(10.5),
    inPlaceOf: null,
    pairs,
    ...overrides,
  };
}
