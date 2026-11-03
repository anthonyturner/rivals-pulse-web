import { matchup, matchupsOf } from './hero-matchup.fixtures';
import { matchupNotice } from './matchup-notice';

describe('matchupNotice', () => {
  it('says the matchups are loading while they have not arrived', () => {
    expect(matchupNotice(undefined)).toEqual({ kind: 'loading', heading: null, message: 'Loading matchups…' });
  });

  it('says the matchups are unavailable when they could not be read', () => {
    expect(matchupNotice(null)?.kind).toBe('error');
    expect(matchupNotice(null)?.heading).toBe('Matchups unavailable');
  });

  it('names the minimum when no pairing has enough matches yet', () => {
    const notice = matchupNotice(matchupsOf([]));

    expect(notice?.kind).toBe('empty');
    expect(notice?.message).toContain('in 10 recorded matches');
  });

  it('is null once there are records to show', () => {
    expect(matchupNotice(matchupsOf([matchup('angela', 'hulk', 9, 12)]))).toBeNull();
  });
});
