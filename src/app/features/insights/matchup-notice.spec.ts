import { matchup, matchupsOf } from './hero-matchup.fixtures';
import { matchupNotice } from './matchup-notice';

describe('matchupNotice', () => {
  it('says the matchups are loading while they have not arrived', () => {
    expect(matchupNotice(undefined, 'Chips work.')).toEqual({ kind: 'loading', heading: null, message: 'Loading matchups…' });
  });

  it('says the matchups are unavailable when they could not be read', () => {
    expect(matchupNotice(null, 'The chips still work.')).toEqual({
      kind: 'error',
      heading: 'Matchups unavailable',
      message: 'RivalsPulse player matchups cannot be loaded right now. The chips still work.',
    });
  });

  it('names the minimum when no pairing has enough matches yet', () => {
    const notice = matchupNotice(matchupsOf([]), 'Chips work.');

    expect(notice?.kind).toBe('empty');
    expect(notice?.message).toContain('in 10 recorded matches');
  });

  it('is null once there are records to show', () => {
    expect(matchupNotice(matchupsOf([matchup('angela', 'hulk', 9, 12)]), 'Chips work.')).toBeNull();
  });
});
