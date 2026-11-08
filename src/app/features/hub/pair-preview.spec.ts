import { heroOf } from '../insights/hero-matchup.fixtures';
import { synergiesOf, synergy } from '../insights/hero-synergies.fixtures';
import { pairPreview } from './pair-preview';

const roster = [
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('luna-snow', 'Luna Snow', 'Strategist'),
];

describe('pairPreview', () => {
  it('gives the best duo of each role that has one, and leaves the other roles out', () => {
    const pairs = pairPreview(
      synergiesOf([synergy('hulk', 'thor', 9, 12), synergy('storm', 'hela', 7, 12), synergy('hulk', 'mantis', 12, 12)]),
      roster,
    );

    expect(pairs.map((pair) => [pair.role, pair.first.name, pair.second.name, pair.winRateLabel])).toEqual([
      ['Vanguard', 'Hulk', 'Thor', '75.0%'],
      ['Duelist', 'Storm', 'Hela', '58.3%'],
    ]);
  });

  it('is empty before any pair has enough matches', () => {
    expect(pairPreview(synergiesOf([]), roster)).toEqual([]);
  });
});
