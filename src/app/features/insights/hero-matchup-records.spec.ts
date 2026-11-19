import { matchup, matchupsOf } from './hero-matchup.fixtures';
import {
  matchupBetween,
  matchupCountOf,
  counterRuleNote,
  noCounterMessage,
  recordCards,
  recordEdgeLabel,
  recordSampleLabel,
  recordSentence,
  recordWinRateLabel,
  strongestRecords,
  winningRecordsAgainst,
  winningRecordsOf,
} from './hero-matchup-records';

const roster = [
  { id: 'hulk', name: 'Hulk', imageUrl: '/hulk.png' },
  { id: 'thor', name: 'Thor', imageUrl: '/thor.png' },
  { id: 'storm', name: 'Storm', imageUrl: '/storm.png' },
];

describe('hero matchup records', () => {
  const matchups = matchupsOf([
    matchup('hulk', 'thor', 9, 12),
    matchup('storm', 'thor', 11, 12),
    matchup('thor', 'hulk', 3, 12),
    matchup('thor', 'storm', 1, 12),
    matchup('hulk', 'storm', 6, 12),
  ]);

  it('lists only the pairs the server marked as counters, whatever the win rate says', () => {
    const marked = matchupsOf([
      matchup('hulk', 'thor', 9, 12, { isCounter: false }),
      matchup('storm', 'thor', 5, 12, { isCounter: true, edge: 4 }),
      matchup('mantis', 'thor', 6, 12, { isCounter: true, edge: 8 }),
    ]);

    expect(winningRecordsAgainst(marked, 'thor').map((record) => record.hero)).toEqual(['storm', 'mantis']);
    expect(winningRecordsOf(marked, 'hulk')).toEqual([]);
  });

  it('puts the largest edge first among the strongest counters, then the larger sample, then the names', () => {
    const marked = matchupsOf([
      matchup('hulk', 'thor', 11, 12, { isCounter: true, edge: 4 }),
      matchup('storm', 'thor', 9, 12, { isCounter: true, edge: 9 }),
      matchup('mantis', 'thor', 14, 20, { isCounter: true, edge: 4 }),
      matchup('thor', 'hulk', 12, 12, { isCounter: false, edge: 1 }),
    ]);

    expect(strongestRecords(marked, 10).map((record) => record.hero)).toEqual(['storm', 'mantis', 'hulk']);
    expect(strongestRecords(marked, 1).map((record) => record.hero)).toEqual(['storm']);
  });

  it('lists who counters a hero', () => {
    expect(winningRecordsAgainst(matchups, 'thor').map((record) => record.hero)).toEqual(['hulk', 'storm']);
    expect(winningRecordsAgainst(matchups, 'storm')).toEqual([]);
  });

  it('lists whom a hero counters', () => {
    expect(winningRecordsOf(matchups, 'hulk').map((record) => record.enemy)).toEqual(['thor']);
    expect(winningRecordsOf(matchups, 'thor')).toEqual([]);
  });

  it('counts and finds the records of a hero', () => {
    expect(matchupCountOf(matchups, 'hulk')).toBe(2);
    expect(matchupCountOf(matchups, 'deadpool')).toBe(0);
    expect(matchupBetween(matchups, 'hulk', 'thor')?.wins).toBe(9);
    expect(matchupBetween(matchups, 'storm', 'hulk')).toBeUndefined();
  });

  it('words a record from the winner against the loser, with its sample', () => {
    const record = matchup('hulk', 'thor', 9, 12);

    expect(recordWinRateLabel(record)).toBe('75.0%');
    expect(recordSampleLabel(record)).toBe('12 matches');
    expect(recordSentence(record, 'Hulk', 'Thor')).toBe('Hulk won 9 of 12 against Thor (75.0%) in 12 matches.');
  });

  it('turns records into cards of the hero shown, and leaves out a hero the roster lacks', () => {
    const records = winningRecordsAgainst(matchups, 'thor');
    const cards = recordCards(records, 'hero', roster);

    expect(cards.map((card) => card.hero.name)).toEqual(['Hulk', 'Storm']);
    expect(cards[1].description).toBe('Storm won 11 of 12 against Thor (91.7%) in 12 matches.');
    expect(recordCards(records, 'enemy', roster).map((card) => card.hero.name)).toEqual(['Thor', 'Thor']);
    expect(recordCards(records, 'hero', roster.slice(1)).map((card) => card.hero.name)).toEqual(['Storm']);
  });

  it('orders cards by sample size, then name, and never by how strong the record is', () => {
    const records = [
      matchup('storm', 'thor', 11, 12),
      matchup('hulk', 'thor', 14, 20),
      matchup('mantis', 'thor', 9, 12),
    ];
    const withMantis = [...roster, { id: 'mantis', name: 'Mantis', imageUrl: '/mantis.png' }];

    expect(recordCards(records, 'hero', withMantis).map((card) => card.hero.name)).toEqual(['Hulk', 'Mantis', 'Storm']);
  });

  it('never prints NaN, whatever the records hold', () => {
    const text = JSON.stringify(recordCards(winningRecordsOf(matchups, 'hulk'), 'enemy', roster));

    expect(text).not.toMatch(/NaN|Infinity/);
  });

  it('lists the strongest counters first, by edge, and never a pair that is not one', () => {
    const strongest = strongestRecords(matchups, 10);

    expect(strongest.map((record) => `${record.hero}>${record.enemy}`)).toEqual([
      'storm>thor',
      'hulk>thor',
    ]);
  });

  it('breaks a tie by the larger sample and then by hero ids, and stops at the limit', () => {
    const tied = matchupsOf([
      matchup('hulk', 'thor', 18, 24),
      matchup('storm', 'thor', 9, 12),
      matchup('hulk', 'storm', 9, 12),
    ]);

    expect(strongestRecords(tied, 10).map((record) => `${record.hero}>${record.enemy}`)).toEqual([
      'hulk>thor',
      'hulk>storm',
      'storm>thor',
    ]);
    expect(strongestRecords(tied, 1).length).toBe(1);
    expect(strongestRecords(tied, 0)).toEqual([]);
  });
});

describe('counter wording', () => {
  it('words the edge in points against the hero\'s usual win rate', () => {
    expect(recordEdgeLabel(matchup('hulk', 'thor', 9, 12, { edge: 3.34 }))).toBe('+3.3 pts vs usual');
    expect(recordEdgeLabel(matchup('hulk', 'thor', 9, 12, { edge: -1.26 }))).toBe('−1.3 pts vs usual');
    expect(recordEdgeLabel(matchup('hulk', 'thor', 9, 12, { edge: 0.02 }))).toBe('Even with usual');
  });

  it('states the rule the server applies, once, with the minimum the answer names', () => {
    expect(counterRuleNote(10)).toBe(
      'A hero is listed when its win rate against the other, adjusted for small samples, is at least 3 points above its own usual win rate, over at least 10 recorded matches. The usual win rate is adjusted the same way, while a card shows the plain win rate, so 76.7% against a plain 64% can show fewer than 12.7 points above usual. The Rivals Pulse app uses the same rule.',
    );
  });

  describe('the empty state of a list', () => {
    const matchups = matchupsOf([matchup('hulk', 'thor', 3, 12), matchup('storm', 'thor', 4, 12), matchup('thor', 'hulk', 3, 12)]);

    it('names how many heroes were checked against the hero', () => {
      expect(noCounterMessage(matchups, 'thor', 'Thor', 'against')).toBe(
        'No hero does at least 3 points better against Thor than it usually does, across the 2 heroes with 10 or more recorded matches against Thor.',
      );
    });

    it('names how many heroes were checked for the hero', () => {
      expect(noCounterMessage(matchups, 'thor', 'Thor', 'for')).toBe(
        'Thor does not do at least 3 points better than usual against any of the 1 hero it has 10 or more recorded matches against.',
      );
    });

    it('says plainly when nothing was checked', () => {
      expect(noCounterMessage(matchups, 'loki', 'Loki', 'against')).toBe('No hero has 10 or more recorded matches against Loki yet.');
      expect(noCounterMessage(matchups, 'loki', 'Loki', 'for')).toBe('Loki has no 10 or more recorded matches against another hero yet.');
    });
  });
});
