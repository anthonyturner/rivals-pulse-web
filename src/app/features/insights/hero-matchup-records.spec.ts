import { matchup, matchupsOf } from './hero-matchup.fixtures';
import {
  WINNING_RECORD_CUT_OFF,
  hasWinningRecord,
  matchupBetween,
  matchupCountOf,
  recordCards,
  recordSampleLabel,
  recordSentence,
  recordWinRateLabel,
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

  it('calls a record winning only when the shrunk win rate is above even', () => {
    expect(WINNING_RECORD_CUT_OFF).toBe(50);
    expect(hasWinningRecord(matchup('hulk', 'thor', 9, 12))).toBeTrue();
    expect(hasWinningRecord(matchup('hulk', 'thor', 5, 10))).toBeFalse();
    expect(hasWinningRecord(matchup('hulk', 'thor', 3, 12))).toBeFalse();
  });

  it('lists who has a winning record against a hero, best record first', () => {
    expect(winningRecordsAgainst(matchups, 'thor').map((record) => record.hero)).toEqual(['storm', 'hulk']);
    expect(winningRecordsAgainst(matchups, 'storm')).toEqual([]);
  });

  it('lists who a hero has a winning record against, best record first', () => {
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

    expect(cards.map((card) => card.hero.name)).toEqual(['Storm', 'Hulk']);
    expect(cards[0].description).toBe('Storm won 11 of 12 against Thor (91.7%) in 12 matches.');
    expect(recordCards(records, 'enemy', roster).map((card) => card.hero.name)).toEqual(['Thor', 'Thor']);
    expect(recordCards(records, 'hero', roster.slice(1)).map((card) => card.hero.name)).toEqual(['Storm']);
  });

  it('never prints NaN, whatever the records hold', () => {
    const text = JSON.stringify(recordCards(winningRecordsOf(matchups, 'hulk'), 'enemy', roster));

    expect(text).not.toMatch(/NaN|Infinity/);
  });
});
