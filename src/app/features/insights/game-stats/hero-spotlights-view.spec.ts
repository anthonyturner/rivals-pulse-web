import { heroIdentities } from '../hero-identity';
import { statsHero, statsOf } from '../hero-stats.fixtures';
import { buildHeroSpotlightsView } from './hero-spotlights-view';

const IDENTITIES = heroIdentities([
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' },
  { id: 'hela', name: 'Hela', role: 'Duelist', imageUrl: '/images/heroes/hela.png' },
  { id: 'hulk', name: 'Hulk', role: 'Vanguard', imageUrl: '/images/heroes/hulk.png' },
]);

const READY = statsOf([
  { name: 'S', heroes: [statsHero('storm', 40, 26, 13.4, 'S')] },
  { name: 'B', heroes: [statsHero('hela', 30, 15, 20.1), statsHero('hulk', 12, 6, 4.2)] },
]);

describe('buildHeroSpotlightsView', () => {
  it('holds the room while the numbers are still on their way', () => {
    expect(buildHeroSpotlightsView(undefined, IDENTITIES)).toEqual({ kind: 'loading' });
  });

  it('draws nothing for numbers that could not be read or that no hero has reached the minimum in', () => {
    expect(buildHeroSpotlightsView(null, IDENTITIES)).toEqual({ kind: 'none' });
    expect(buildHeroSpotlightsView(statsOf([]), IDENTITIES)).toEqual({ kind: 'none' });
  });

  it('names the hero picked most and the hero that wins most, the first of the Heroes tab lists', () => {
    const view = buildHeroSpotlightsView(READY, IDENTITIES);

    expect(view.kind).toBe('ready');

    if (view.kind !== 'ready') {
      return;
    }

    const [picked, won] = view.spotlights;

    expect([picked.heading, picked.figureLabel, picked.hero.name, picked.hero.figure, picked.hero.sample]).toEqual([
      'Most picked',
      'pick rate',
      'Hela',
      '20.1%',
      '30 games',
    ]);
    expect([won.heading, won.figureLabel, won.hero.name, won.hero.figure, won.hero.sample]).toEqual([
      'Highest win rate',
      'win rate',
      'Storm',
      '65.0%',
      '40 games',
    ]);
  });

  it('leaves out a hero whose figures are not numbers rather than printing NaN', () => {
    const broken = statsOf([{ name: 'S', heroes: [{ ...statsHero('storm', 40, 26, 13.4, 'S'), pickRate: Number.NaN }] }]);

    expect(buildHeroSpotlightsView(broken, IDENTITIES)).toEqual({ kind: 'none' });
  });
});
