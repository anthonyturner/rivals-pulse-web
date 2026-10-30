import type { HeroIdentities } from '../../insights/hero-identity';
import { season, statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { buildHeroesTabView, HEROES_TAB_LEADERS } from './heroes-tab-view';

const identities: HeroIdentities = new Map([
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
  ['hela', { name: 'Hela', role: 'Duelist', imageUrl: '/images/heroes/hela.png' }],
]);

const READY = statsOf([
  { name: 'S', heroes: [statsHero('storm', 20, 14, 13.4, 'S')] },
  { name: 'B', heroes: [statsHero('hela', 30, 15, 20.1), statsHero('mantis', 12, 4, 8)] },
]);

describe('buildHeroesTabView', () => {
  it('is loading until the stats answer, and unavailable once they could not be read', () => {
    expect(buildHeroesTabView(undefined, identities).kind).toBe('loading');
    expect(buildHeroesTabView(null, identities).kind).toBe('unavailable');
  });

  it('lists the most-picked and the highest-winning heroes with the figures of the win-rates page', () => {
    const view = buildHeroesTabView(READY, identities);

    if (view.kind !== 'ready') {
      fail(`expected ready, got ${view.kind}`);
      return;
    }

    expect(view.mostPicked.map((hero) => [hero.name, hero.figure])).toEqual([
      ['Hela', '20.1%'],
      ['Storm', '13.4%'],
      ['Mantis', '8.0%'],
    ]);
    expect(view.highestWinRate.map((hero) => [hero.name, hero.figure])).toEqual([
      ['Storm', '70.0%'],
      ['Hela', '50.0%'],
      ['Mantis', '33.3%'],
    ]);
    expect(view.mostPicked[0].sample).toBe('30 appearances');
    expect(view.matchesLabel).toBe('149 matches');
    expect(view.halfSeasonLabel).toBe('Season 10.5');
    expect(view.notice).toBeNull();
  });

  it('draws a hero the roster lacks under its spelled-out id instead of dropping it', () => {
    const view = buildHeroesTabView(READY, identities);

    expect(view.kind === 'ready' && view.mostPicked.some((hero) => hero.name === 'Mantis')).toBeTrue();
  });

  it('stops at the leader limit and breaks a tie by appearances and then name', () => {
    const many = statsOf([
      {
        name: 'B',
        heroes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((hero) => statsHero(hero, 10, 5, 10)),
      },
    ]);
    const view = buildHeroesTabView(many, new Map());

    expect(view.kind === 'ready' && view.mostPicked.map((hero) => hero.name)).toEqual(
      ['A', 'B', 'C', 'D', 'E'].slice(0, HEROES_TAB_LEADERS),
    );
  });

  it('says the previous half-season stands in for the current one', () => {
    const view = buildHeroesTabView(
      statsOf(READY.tiers, { halfSeason: season(10), inPlaceOf: season(10.5) }),
      identities,
    );

    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
  });

  it('is the designed empty state, naming the minimum, when no hero has enough appearances', () => {
    const view = buildHeroesTabView(statsOf([], { matchesCounted: 12 }), identities);

    expect(view).toEqual({
      kind: 'not-enough-data',
      summary: "12 matches recorded by Rivals Pulse players so far. A hero's numbers appear at 10 appearances.",
    });
  });

  it('says plainly that no match is counted yet', () => {
    const view = buildHeroesTabView(statsOf([], { matchesCounted: 0, halfSeason: null, halfSeasons: [] }), identities);

    expect(view.kind === 'not-enough-data' && view.summary).toContain('No match recorded by Rivals Pulse players is counted yet.');
  });

  it('leaves out a line with a figure that is not a number, so NaN is never printed', () => {
    const broken = { ...statsHero('hela', 30, 15, 20), winRate: Number.NaN };
    const view = buildHeroesTabView(statsOf([{ name: 'B', heroes: [broken, statsHero('storm', 20, 14, 13.4)] }]), identities);

    expect(JSON.stringify(view)).not.toMatch(/NaN|null%|undefined/);
    expect(view.kind === 'ready' && view.mostPicked.map((hero) => hero.name)).toEqual(['Storm']);
  });
});
