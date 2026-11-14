import {
  FIRST_WIN_GAP_MS,
  RESTED_GAP_MS,
  XP_FIRST_WIN_BONUS,
  XP_RESTED_BONUS,
  matchXpBonuses,
  type XpBonusMatch,
} from './hero-xp-bonuses';

const HOUR = 60 * 60 * 1000;
const START = 1_753_600_000_000;

/** A match that ends `hours` hours after `START`. */
function match(key: string, hours: number, won: boolean): XpBonusMatch {
  return { matchKey: key, endedAt: START + hours * HOUR, won };
}

/** A match that ends `gapMs` after `previous` ended. */
function after(previous: XpBonusMatch, key: string, gapMs: number, won: boolean): XpBonusMatch {
  return { matchKey: key, endedAt: previous.endedAt + gapMs, won };
}

describe('hero-xp-bonuses', () => {
  // The boundary spec: the website copies this file and must pass it unchanged, so it names the same amounts and gaps.
  it('names the bonus amounts and the two gaps', () => {
    expect(XP_FIRST_WIN_BONUS).toBe(150);
    expect(XP_RESTED_BONUS).toBe(100);
    expect(FIRST_WIN_GAP_MS).toBe(20 * HOUR);
    expect(RESTED_GAP_MS).toBe(2 * HOUR);
  });

  describe('first win', () => {
    it('goes to the first counted win', () => {
      expect(matchXpBonuses([match('a', 0, true)]).get('a')).toEqual({ firstWin: true, rested: false, xp: 150 });
    });

    it('skips a loss and goes to the first win after it', () => {
      const bonuses = matchXpBonuses([match('a', 0, false), match('b', 0.5, true), match('c', 1, true)]);

      expect(bonuses.get('a')?.firstWin).toBeFalse();
      expect(bonuses.get('b')?.firstWin).toBeTrue();
      expect(bonuses.get('c')?.firstWin).toBeFalse();
    });

    it('is earned again by a win exactly 20 hours after the last win that earned it, not 1 ms sooner', () => {
      const first = match('a', 0, true);

      expect(matchXpBonuses([first, after(first, 'b', FIRST_WIN_GAP_MS - 1, true)]).get('b')?.firstWin).toBeFalse();
      expect(matchXpBonuses([first, after(first, 'c', FIRST_WIN_GAP_MS, true)]).get('c')?.firstWin).toBeTrue();
    });

    it('counts the 20 hours from the last win that earned the bonus, not from the last win', () => {
      const bonuses = matchXpBonuses([match('a', 0, true), match('b', 12, true), match('c', 20.5, true)]);

      expect(bonuses.get('b')?.firstWin).toBeFalse();
      expect(bonuses.get('c')?.firstWin).toBeTrue();
    });

    it('is earned about once a day by a player who wins every day', () => {
      const days = Array.from({ length: 5 }, (_, day) => [match(`d${day}a`, day * 24, true), match(`d${day}b`, day * 24 + 1, true)]).flat();
      const earned = [...matchXpBonuses(days)].filter(([, bonus]) => bonus.firstWin).map(([key]) => key);

      expect(earned).toEqual(['d0a', 'd1a', 'd2a', 'd3a', 'd4a']);
    });
  });

  describe('rested', () => {
    it('goes to the first match that ends 2 hours or more after the previous one ended, whatever its result', () => {
      const bonuses = matchXpBonuses([match('a', 0, true), match('b', 3, false)]);

      expect(bonuses.get('b')).toEqual({ firstWin: false, rested: true, xp: 100 });
    });

    it('measures the gap from one match ending to the next ending, at exactly 2 hours and not 1 ms sooner', () => {
      const first = match('a', 0, false);

      expect(matchXpBonuses([first, after(first, 'b', RESTED_GAP_MS, false)]).get('b')?.rested).toBeTrue();
      expect(matchXpBonuses([first, after(first, 'c', RESTED_GAP_MS - 1, false)]).get('c')?.rested).toBeFalse();
    });

    it('measures from the previous match that ended, so a loss and a win count alike', () => {
      const first = match('a', 0, true);

      expect(matchXpBonuses([first, after(first, 'b', RESTED_GAP_MS, true)]).get('b')?.rested).toBeTrue();
    });

    it('is not earned by the first match there is, which has no break before it', () => {
      expect(matchXpBonuses([match('a', 0, false)]).get('a')?.rested).toBeFalse();
    });
  });

  it('stacks the two bonuses on a won match that follows a break', () => {
    const bonuses = matchXpBonuses([match('a', 0, true), match('b', 24, true)]);

    expect(bonuses.get('b')).toEqual({ firstWin: true, rested: true, xp: 250 });
  });

  it('gives the same answer for the same matches in any order, ties included', () => {
    const matches = [
      match('a', 0, true), match('b', 0, true), match('c', 1, false), match('d', 5, true),
      match('e', 26, true), match('f', 26, true), match('g', 30, false),
    ];
    const expected = [...matchXpBonuses(matches)];

    expect([...matchXpBonuses([...matches].reverse())]).toEqual(jasmine.arrayWithExactContents(expected));
    expect([...matchXpBonuses([...matches.slice(3), ...matches.slice(0, 3)])]).toEqual(jasmine.arrayWithExactContents(expected));
  });

  it('breaks a tie in end time by match key, so only the lower key takes the first win', () => {
    const bonuses = matchXpBonuses([match('b', 0, true), match('a', 0, true)]);

    expect(bonuses.get('a')?.firstWin).toBeTrue();
    expect(bonuses.get('b')?.firstWin).toBeFalse();
  });

  it('does not change the list it is given', () => {
    const matches = [match('b', 1, true), match('a', 0, true)];

    matchXpBonuses(matches);

    expect(matches.map(({ matchKey }) => matchKey)).toEqual(['b', 'a']);
  });

  it('gives nothing for no matches', () => {
    expect(matchXpBonuses([]).size).toBe(0);
  });
});
