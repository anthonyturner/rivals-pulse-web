import type { HeroStats, HeroStatsHero } from '../../../contracts/hero-stats.model.ts';
import { estimateWinRatePriors, shrunkRate } from '../stats/win-rate-prior';
import {
  chooseSpecialistsHalfSeason,
  deriveHeroSpecialists,
  HERO_SPECIALISTS_MIN_MATCHES,
  HERO_SPECIALISTS_MIN_PLAYERS,
  type HeroSpecialistRow,
} from './hero-specialists';

const NOW = new Date('2026-11-11T12:00:00Z');
const SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];
const SLUGS = new Map([
  [1042, 'peni-parker'],
  [1011, 'hulk'],
  [1057, 'deadpool'],
]);

function row(gameHeroId: number, extra: Partial<HeroSpecialistRow> = {}): HeroSpecialistRow {
  return {
    halfSeason: 10.5,
    gameHeroId,
    specialistMatches: 60,
    specialistWins: 36,
    flexMatches: 120,
    flexWins: 54,
    ...extra,
  };
}

function placed(hero: string, appearances: number, wins: number): HeroStatsHero {
  return {
    hero,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 5,
    shrunkWinRate: 50,
    tier: 'B',
    kda: null,
    finalHitsAverage: null,
  };
}

/** The hero stats of the half-season the figures come from: the shared input. */
function ownStats(heroes: HeroStatsHero[] = [], belowMinimum: string[] = []): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [],
    halfSeason: null,
    inPlaceOf: null,
    matchesCounted: 400,
    tiers: [{ name: 'B', heroes }],
    belowMinimum: belowMinimum.map((hero) => ({ hero, appearances: 4 })),
  };
}

const OWN = [placed('peni-parker', 300, 150), placed('hulk', 200, 90), placed('deadpool', 100, 50)];

function derive(rows: HeroSpecialistRow[], stats: HeroStats = ownStats(OWN)) {
  const choice = chooseSpecialistsHalfSeason(rows, SEASONS, NOW, SLUGS);

  return deriveHeroSpecialists(rows, choice, stats, SLUGS);
}

describe('chooseSpecialistsHalfSeason', () => {
  it('shows the current half-season when a hero is ready in it', () => {
    const choice = chooseSpecialistsHalfSeason([row(1042)], SEASONS, NOW, SLUGS);

    expect(choice.shown).toBe(10.5);
    expect(choice.inPlaceOf).toBeUndefined();
  });

  it('falls back to the previous half-season while the current one has no hero to show', () => {
    const choice = chooseSpecialistsHalfSeason([row(1042, { halfSeason: 10 })], SEASONS, NOW, SLUGS);

    expect(choice.shown).toBe(10);
    expect(choice.inPlaceOf).toBe(10.5);
  });

  it('keeps the current half-season when neither has a hero', () => {
    const choice = chooseSpecialistsHalfSeason([], SEASONS, NOW, SLUGS);

    expect(choice.shown).toBe(10.5);
    expect(choice.inPlaceOf).toBeUndefined();
  });

  it('does not count a row as a hero to show when the site does not know the hero', () => {
    const choice = chooseSpecialistsHalfSeason([row(0), row(1042, { halfSeason: 10 })], SEASONS, NOW, SLUGS);

    expect(choice.shown).toBe(10);
  });
});

describe('deriveHeroSpecialists', () => {
  it('publishes both buckets of a ready hero as rates and a band, with the minimums and the definition', () => {
    const { specialists } = derive([row(1042)]);

    expect(specialists.status).toBe('ready');
    expect(specialists.minimumMatches).toBe(HERO_SPECIALISTS_MIN_MATCHES);
    expect(specialists.minimumPlayers).toBe(HERO_SPECIALISTS_MIN_PLAYERS);
    expect(specialists.halfSeason?.id).toBe(10.5);
    expect(specialists.inPlaceOf).toBeNull();
    expect(specialists.definition).toEqual({
      specialistMinShare: 0.5,
      specialistMinHeroMatches: 10,
      flexMaxTopShare: 0.25,
      flexMinHeroes: 5,
      flexMinMatches: 20,
    });
    expect(specialists.heroes.find((hero) => hero.hero === 'peni-parker')).toEqual({
      hero: 'peni-parker',
      status: 'ready',
      specialist: jasmine.objectContaining({ winRate: 60, matchesBand: '50+' }),
      flex: jasmine.objectContaining({ winRate: 45, matchesBand: '100+' }),
    });
  });

  it('pulls each bucket toward the hero\'s own win rate with the strength the hero stats estimate', () => {
    const { specialists } = derive([row(1042)]);
    const strength = estimateWinRatePriors(OWN.map((hero) => ({ matches: hero.appearances, wins: hero.wins }))).strength;
    const expected = (matches: number, wins: number): number =>
      Math.round(shrunkRate({ matches, wins }, { mean: 0.5, strength }) * 1000) / 10;
    const hero = specialists.heroes.find((candidate) => candidate.hero === 'peni-parker');

    expect(hero?.specialist?.shrunkWinRate).toBe(expected(60, 36));
    expect(hero?.flex?.shrunkWinRate).toBe(expected(120, 54));
    expect(hero?.specialist?.shrunkWinRate).toBeLessThan(60);
    expect(hero?.flex?.shrunkWinRate).toBeGreaterThan(45);
  });

  it('rounds every rate to one decimal', () => {
    const { specialists } = derive([row(1042, { specialistMatches: 53, specialistWins: 31 })]);

    expect(specialists.heroes.find((hero) => hero.hero === 'peni-parker')?.specialist?.winRate).toBe(58.5);
  });

  it('steps the band at 100, 250 and 500 matches and never below the 50 minimum', () => {
    const bands = [50, 99, 100, 249, 250, 499, 500, 4000].map((matches) => {
      const { specialists } = derive([row(1042, { specialistMatches: matches, specialistWins: matches / 2 })]);

      return specialists.heroes.find((hero) => hero.hero === 'peni-parker')?.specialist?.matchesBand;
    });

    expect(bands).toEqual(['50+', '50+', '100+', '100+', '250+', '250+', '500+', '500+']);
  });

  it('lists a hero with matches but no bucket pair as not enough data, with no figure and no count', () => {
    const { specialists } = derive([row(1042)]);
    const hulk = specialists.heroes.find((hero) => hero.hero === 'hulk');

    expect(hulk).toEqual({ hero: 'hulk', status: 'not-enough-data' });
  });

  it('lists the heroes of the half-season by hero id, placed or below the minimum', () => {
    const { specialists } = derive([row(1042)], ownStats(OWN, ['black-widow']));

    expect(specialists.heroes.map((hero) => hero.hero)).toEqual(['black-widow', 'deadpool', 'hulk', 'peni-parker']);
  });

  it('is not enough data, with the hero list, when no hero has both buckets', () => {
    const { specialists } = derive([]);

    expect(specialists.status).toBe('not-enough-data');
    expect(specialists.halfSeason?.id).toBe(10.5);
    expect(specialists.heroes.every((hero) => hero.status === 'not-enough-data')).toBeTrue();
  });

  it('is empty before any half-season exists', () => {
    const rows: HeroSpecialistRow[] = [];
    const choice = chooseSpecialistsHalfSeason(rows, [], NOW, SLUGS);
    const { specialists } = deriveHeroSpecialists(rows, choice, ownStats(), SLUGS);

    expect(specialists.halfSeason).toBeNull();
    expect(specialists.heroes).toEqual([]);
    expect(specialists.status).toBe('not-enough-data');
  });

  it('names the current half-season being replaced when the previous one is shown', () => {
    const { specialists } = derive([row(1042, { halfSeason: 10 })]);

    expect(specialists.halfSeason?.id).toBe(10);
    expect(specialists.inPlaceOf?.id).toBe(10.5);
    expect(specialists.status).toBe('ready');
  });

  it('shows a hero only with the minimum matches in both buckets, even if the database lets a thinner one through', () => {
    const { specialists } = derive([
      row(1042, { specialistMatches: HERO_SPECIALISTS_MIN_MATCHES - 1, specialistWins: 20 }),
      row(1011, { flexMatches: HERO_SPECIALISTS_MIN_MATCHES - 1, flexWins: 20 }),
    ]);

    expect(specialists.status).toBe('not-enough-data');
    expect(specialists.heroes.map((hero) => hero.status)).toEqual(['not-enough-data', 'not-enough-data', 'not-enough-data']);
  });

  it('refuses wins that exceed matches rather than publishing a rate above 100', () => {
    const { specialists } = derive([row(1042, { specialistWins: 61 })]);

    expect(specialists.heroes.find((hero) => hero.hero === 'peni-parker')?.status).toBe('not-enough-data');
  });

  it('does not show a hero whose own record is not placed: there is nothing to pull toward', () => {
    const { specialists } = derive([row(1042)], ownStats(OWN.slice(1), ['peni-parker']));

    expect(specialists.heroes.find((hero) => hero.hero === 'peni-parker')).toEqual({
      hero: 'peni-parker',
      status: 'not-enough-data',
    });
  });

  it('leaves a game hero id with no hero out and names it', () => {
    const { specialists, excludedGameIds } = derive([row(0), row(9999), row(1042)]);

    expect(excludedGameIds).toEqual([0, 9999]);
    expect(specialists.heroes.filter((hero) => hero.status === 'ready').map((hero) => hero.hero)).toEqual(['peni-parker']);
  });

  it('publishes only the named fields: the exact counts stay out of the answer', () => {
    const { specialists } = derive([row(1042)]);
    const ready = specialists.heroes.find((hero) => hero.status === 'ready');

    expect(Object.keys(ready ?? {}).sort()).toEqual(['flex', 'hero', 'specialist', 'status']);
    expect(Object.keys(ready?.specialist ?? {}).sort()).toEqual(['matchesBand', 'shrunkWinRate', 'winRate']);
    expect(Object.keys(specialists).sort()).toEqual([
      'definition',
      'halfSeason',
      'heroes',
      'inPlaceOf',
      'minimumMatches',
      'minimumPlayers',
      'status',
    ]);
  });
});
