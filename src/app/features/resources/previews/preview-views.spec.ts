import { heroOf } from '../../insights/hero-matchup.fixtures';
import { statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { STRATEGIST_GUIDES } from '../../learning/guides/strategist-guides/strategist-guides.data';
import { HEROES_PER_TIER, WIN_RATE_ROWS, strategistPreview, tierPreview, winRatePreview } from './preview-views';

const roster = [
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('luna-snow', 'Luna Snow', 'Strategist'),
];

describe('tierPreview', () => {
  it('takes the S, A and B tiers and skips the others and any that is empty', () => {
    const stats = statsOf([
      { name: 'S', heroes: [statsHero('hulk', 20, 15, 10, 'S')] },
      { name: 'A', heroes: [statsHero('storm', 20, 13, 10, 'A')] },
      { name: 'B', heroes: [] },
      { name: 'C', heroes: [statsHero('thor', 20, 8, 10, 'C')] },
    ]);

    expect(tierPreview(stats, roster).map((row) => [row.name, row.heroes.map((hero) => hero.name)])).toEqual([
      ['S', ['Hulk']],
      ['A', ['Storm']],
    ]);
  });

  it('shows a few heroes per tier, with the portrait the roster gives', () => {
    const many = ['hulk', 'thor', 'storm', 'hela', 'mantis', 'luna-snow'].map((id) => statsHero(id, 20, 14, 10, 'S'));
    const [row] = tierPreview(statsOf([{ name: 'S', heroes: many }]), roster);

    expect(row.heroes.length).toBe(HEROES_PER_TIER);
    expect(row.heroes[0]).toEqual({ hero: 'hulk', name: 'Hulk', imageUrl: '/images/heroes/hulk.png' });
  });

  it('is empty while no hero has reached the minimum', () => {
    expect(tierPreview(statsOf([], { matchesCounted: 3 }), roster)).toEqual([]);
  });
});

describe('winRatePreview', () => {
  const stats = statsOf([
    {
      name: 'S',
      heroes: [
        statsHero('hulk', 20, 12, 10),
        statsHero('storm', 20, 16, 10),
        statsHero('mantis', 20, 14, 10),
        statsHero('thor', 20, 13, 10),
      ],
    },
  ]);

  it('lists the best win rates first, with the figure the page shows and a bar as long as the rate', () => {
    const rows = winRatePreview(stats, roster);

    expect(rows.map((row) => row.name)).toEqual(['Storm', 'Mantis', 'Thor']);
    expect(rows.length).toBe(WIN_RATE_ROWS);
    expect(rows[0].winRateLabel).toBe('80.0%');
    expect(rows[0].barPercent).toBe(80);
  });

  it('is empty when no hero has a readable record', () => {
    expect(winRatePreview(statsOf([]), roster)).toEqual([]);
  });
});

describe('strategistPreview', () => {
  it('names each topic and each hero once, as the guides do', () => {
    const { topics, heroes } = strategistPreview();

    expect(topics).toEqual([...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))]);
    expect(heroes.map((hero) => hero.imageUrl)).toEqual([...new Set(STRATEGIST_GUIDES.map((guide) => guide.heroImage))]);
  });
});
