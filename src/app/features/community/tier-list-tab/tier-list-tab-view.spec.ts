import type { HeroIdentities } from '../../insights/hero-identity';
import { season, statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { buildTierListTabView } from './tier-list-tab-view';

const identities: HeroIdentities = new Map([
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
]);

const READY = statsOf([
  { name: 'S', heroes: [statsHero('hela', 12, 11, 9, 'S'), statsHero('storm', 40, 33, 12, 'S')] },
  { name: 'A', heroes: [statsHero('hulk', 20, 13, 7, 'A')] },
  { name: 'B', heroes: [statsHero('thor', 20, 10, 7)] },
]);

describe('buildTierListTabView', () => {
  it('is loading until the stats answer, and unavailable once they could not be read', () => {
    expect(buildTierListTabView(undefined, identities).kind).toBe('loading');
    expect(buildTierListTabView(null, identities).kind).toBe('unavailable');
  });

  it('lists the S and A tiers only, strongest shrunk win rate first, with win rate and pick rate', () => {
    const view = buildTierListTabView(READY, identities);

    if (view.kind !== 'ready') {
      fail(`expected ready, got ${view.kind}`);
      return;
    }

    expect(view.tiers.map((tier) => tier.name)).toEqual(['S', 'A']);
    expect(view.tiers[0].heroes.map((hero) => [hero.name, hero.figure])).toEqual([
      ['Storm', '82.5%'],
      ['Hela', '91.7%'],
    ]);
    expect(view.tiers[0].heroes[0].sample).toBe('12.0% pick rate, 40 appearances');
    expect(view.tiers[1].heroes.map((hero) => hero.name)).toEqual(['Hulk']);
    expect(JSON.stringify(view)).not.toContain('Thor');
  });

  it('keeps a tier with no hero in it, so the summary says it is empty instead of hiding it', () => {
    const view = buildTierListTabView(
      statsOf([{ name: 'B', heroes: [statsHero('thor', 20, 10, 7)] }]),
      identities,
    );

    expect(view.kind === 'ready' && view.tiers.map((tier) => tier.heroes.length)).toEqual([0, 0]);
  });

  it('says the previous half-season stands in for the current one', () => {
    const view = buildTierListTabView(
      statsOf(READY.tiers, { halfSeason: season(10), inPlaceOf: season(10.5) }),
      identities,
    );

    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });

  it('is the designed empty state, naming the minimum, when no hero is placed', () => {
    const view = buildTierListTabView(statsOf([], { matchesCounted: 12 }), identities);

    expect(view).toEqual({
      kind: 'not-enough-data',
      summary: '12 matches recorded by Rivals Pulse players so far. A hero is placed in a tier at 10 appearances.',
    });
  });

  it('never prints NaN, whatever a line holds', () => {
    const broken = { ...statsHero('hela', 12, 11, 9, 'S'), shrunkWinRate: Number.NaN };
    const view = buildTierListTabView(statsOf([{ name: 'S', heroes: [broken, statsHero('storm', 40, 33, 12, 'S')] }]), identities);

    expect(JSON.stringify(view)).not.toMatch(/NaN|undefined/);
    expect(view.kind === 'ready' && view.tiers[0].heroes.map((hero) => hero.name)).toEqual(['Storm']);
  });
});
