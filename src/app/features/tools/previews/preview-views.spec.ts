import { heroOf, matchup, matchupsOf } from '../../insights/hero-matchup.fixtures';
import { synergiesOf, synergy } from '../../insights/hero-synergies.fixtures';
import { ANSWERS_SHOWN, counterPreview, divePreview, teamPreview } from './preview-views';

const roster = [
  heroOf('angela', 'Angela', 'Duelist'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('luna-snow', 'Luna Snow', 'Strategist'),
];

describe('counterPreview', () => {
  it('picks the enemy with the strongest winning record against it, and breaks a tie by hero id', () => {
    const tied = matchupsOf([matchup('thor', 'storm', 9, 12), matchup('hulk', 'angela', 9, 12)]);

    expect(counterPreview(tied, roster)?.enemy.hero).toBe('angela');
  });

  it('lists at most three counters, largest sample first, each with its plain win rate', () => {
    const view = counterPreview(
      matchupsOf([
        matchup('hulk', 'angela', 11, 12),
        matchup('thor', 'angela', 7, 8),
        matchup('storm', 'angela', 8, 10),
        matchup('hela', 'angela', 18, 20),
      ]),
      roster,
    );

    expect(view?.counters.length).toBe(ANSWERS_SHOWN);
    expect(view?.counters.map((counter) => [counter.hero.name, counter.winRate])).toEqual([
      ['Hela', '90.0%'],
      ['Hulk', '91.7%'],
      ['Storm', '80.0%'],
    ]);
  });

  it('skips an enemy the roster does not know and takes the next strongest', () => {
    const view = counterPreview(
      matchupsOf([matchup('hulk', 'someone-new', 11, 12), matchup('thor', 'storm', 8, 10)]),
      roster,
    );

    expect(view?.enemy.hero).toBe('storm');
  });

  it('is null when there is no winning record', () => {
    expect(counterPreview(matchupsOf([]), roster)).toBeNull();
    expect(counterPreview(matchupsOf([matchup('hulk', 'angela', 3, 12)]), roster)).toBeNull();
  });
});

describe('divePreview', () => {
  it('answers the opening divers the roster has with the heroes that beat the most of them', () => {
    const view = divePreview(
      matchupsOf([matchup('hulk', 'angela', 9, 12), matchup('hulk', 'black-cat', 9, 12), matchup('storm', 'angela', 8, 10)]),
      roster,
    );

    expect(view?.threats.map((hero) => hero.hero)).toEqual(['angela', 'black-cat']);
    expect(view?.answers.map((hero) => hero.hero)).toEqual(['hulk', 'storm']);
  });

  it('is null when no hero has a winning record against a diver', () => {
    expect(divePreview(matchupsOf([matchup('hulk', 'thor', 9, 12)]), roster)).toBeNull();
  });
});

describe('teamPreview', () => {
  it('has two slots per role, in role order, and fills them with the best duo of each', () => {
    const slots = teamPreview(
      synergiesOf([synergy('mantis', 'luna-snow', 8, 12), synergy('hulk', 'thor', 9, 12)]),
      roster,
    );

    expect(slots.map((slot) => [slot.role, slot.hero?.hero ?? null])).toEqual([
      ['Vanguard', 'hulk'],
      ['Vanguard', 'thor'],
      ['Duelist', null],
      ['Duelist', null],
      ['Strategist', 'mantis'],
      ['Strategist', 'luna-snow'],
    ]);
  });

  it('is empty, not six plus signs, when no role has a duo', () => {
    expect(teamPreview(synergiesOf([]), roster)).toEqual([]);
  });
});
