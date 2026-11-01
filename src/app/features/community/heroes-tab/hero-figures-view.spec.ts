import { emptyFigures, figuresOf, heroFigures } from '../../insights/community-extended.fixtures';
import { heroIdentities } from '../../insights/hero-identity';
import { season } from '../../insights/hero-matchup.fixtures';
import { HERO_FIGURES_LEADERS, buildHeroFiguresView } from './hero-figures-view';

const IDENTITIES = heroIdentities([
  { id: 'hela', name: 'Hela', role: 'Duelist', imageUrl: '/hela.png' },
  { id: 'hulk', name: 'Hulk', role: 'Vanguard', imageUrl: '/hulk.png' },
  { id: 'luna-snow', name: 'Luna Snow', role: 'Strategist', imageUrl: '/luna.png' },
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/storm.png' },
]);

const READY = figuresOf({}, [
  heroFigures('hela', { damage: 1050 }),
  heroFigures('hulk', { damage: 1200, healing: 0, blocked: 5200 }),
  heroFigures('luna-snow', { healing: 2100 }),
  heroFigures('storm', { damage: 1050, healing: 300 }),
]);

function listed(group: string, figures = READY): string[] {
  const view = buildHeroFiguresView(figures, IDENTITIES);

  return view.kind === 'ready' ? (view.groups.find((entry) => entry.key === group)?.heroes.map((hero) => `${hero.name} ${hero.figure}`) ?? []) : [];
}

describe('buildHeroFiguresView', () => {
  it('is loading before the answer and unavailable when it could not be read', () => {
    expect(buildHeroFiguresView(undefined, IDENTITIES)).toEqual({ kind: 'loading' });
    expect(buildHeroFiguresView(null, IDENTITIES)).toEqual({ kind: 'unavailable' });
  });

  it('lists the leaders of each figure, highest first, with ties by name', () => {
    expect(listed('damage')).toEqual(['Hulk 1,200', 'Hela 1,050', 'Storm 1,050']);
    expect(listed('healing')).toEqual(['Luna Snow 2,100', 'Storm 300']);
    expect(listed('blocked')).toEqual(['Hulk 5,200']);
  });

  it('leaves out a hero with no figure, or a figure of zero, from a list: only a hero that has some can lead', () => {
    expect(listed('healing')).not.toContain('Hulk 0');
    expect(listed('blocked')).not.toContain('Hela Not enough data');
  });

  it('keeps each list to its leaders', () => {
    const many = figuresOf(
      {},
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((hero, index) => heroFigures(hero, { damage: 1000 - index })),
    );
    const view = buildHeroFiguresView(many, IDENTITIES);

    expect(view.kind === 'ready' && view.groups[0].heroes.length).toBe(HERO_FIGURES_LEADERS);
  });

  it('carries no sample, since no line count leaves the server', () => {
    const view = buildHeroFiguresView(READY, IDENTITIES);

    expect(view.kind === 'ready' && view.groups[0].heroes.every((hero) => hero.sample === undefined)).toBeTrue();
  });

  it('is the designed empty state, naming the minimum, when no hero has a figure', () => {
    const view = buildHeroFiguresView(emptyFigures(), IDENTITIES);

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('10 lines');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('at least 3 different players');
  });

  it('is the empty state when only roles have a figure', () => {
    expect(buildHeroFiguresView(figuresOf({ Duelist: { damage: 900 } }), IDENTITIES).kind).toBe('not-enough-data');
  });

  it('says the previous half-season stands in', () => {
    const view = buildHeroFiguresView({ ...READY, halfSeason: season(10), inPlaceOf: season(10.5) }, IDENTITIES);

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });
});
