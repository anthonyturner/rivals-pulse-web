import { matchup, matchupsOf } from './hero-matchup.fixtures';
import {
  MINIMUM_COUNTER_EDGE,
  hasCounterAdvantage,
  matchupBetween,
  matchupCountOf,
  recordCards,
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

  it('requires a three point edge over the hero overall baseline', () => {
    expect(MINIMUM_COUNTER_EDGE).toBe(0.03);
    expect(hasCounterAdvantage(matchup('hulk', 'thor', 9, 12))).toBeTrue();
    expect(hasCounterAdvantage({ ...matchup('hulk', 'thor', 9, 12), edge: 0.03 })).toBeTrue();
    expect(hasCounterAdvantage({ ...matchup('hulk', 'thor', 9, 12), edge: 0.03 - 5e-10 })).toBeTrue();
    expect(hasCounterAdvantage({ ...matchup('hulk', 'thor', 9, 12), edge: 0.029 })).toBeFalse();
  });

  it('lists who has a winning record against a hero', () => {
    expect(winningRecordsAgainst(matchups, 'thor').map((record) => record.hero)).toEqual(['hulk', 'storm']);
    expect(winningRecordsAgainst(matchups, 'storm')).toEqual([]);
  });

  it('lists who a hero has a winning record against', () => {
    expect(winningRecordsOf(matchups, 'hulk').map((record) => record.enemy)).toEqual(['thor']);
    expect(winningRecordsOf(matchups, 'thor')).toEqual([]);
  });

  it('counts and finds the records of a hero', () => {
    expect(matchupCountOf(matchups, 'hulk')).toBe(1);
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

    expect(cards.map((card) => card.hero.name)).toEqual(['Storm', 'Hulk']);
    expect(cards[0].description).toBe('Storm won 11 of 12 against Thor (91.7%) in 12 matches.');
    expect(recordCards(records, 'enemy', roster).map((card) => card.hero.name)).toEqual(['Thor', 'Thor']);
    expect(recordCards(records, 'hero', roster.slice(1)).map((card) => card.hero.name)).toEqual(['Storm']);
  });

  it('orders cards by edge, then sample size and name', () => {
    const records = [
      matchup('storm', 'thor', 11, 12),
      matchup('hulk', 'thor', 14, 20),
      matchup('mantis', 'thor', 9, 12),
    ];
    const withMantis = [...roster, { id: 'mantis', name: 'Mantis', imageUrl: '/mantis.png' }];

    expect(recordCards(records, 'hero', withMantis).map((card) => card.hero.name)).toEqual(['Storm', 'Mantis', 'Hulk']);
  });

  it('never prints NaN, whatever the records hold', () => {
    const text = JSON.stringify(recordCards(winningRecordsOf(matchups, 'hulk'), 'enemy', roster));

    expect(text).not.toMatch(/NaN|Infinity/);
  });

  it('lists the strongest counter edges first, and filters below-threshold matchups', () => {
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
