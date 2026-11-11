import type { GameCounts } from '../../contracts/game-counts.model';
import { matchesCountedIn } from './matches-counted';

const COUNTS: GameCounts = {
  matches: 781,
  players: 8158,
  since: '2026-09-20T02:12:49.000Z',
  halfSeasons: [
    { halfSeason: 10.5, matches: 484, players: 5035 },
    { halfSeason: 10, matches: 297, players: 3165 },
  ],
};

describe('matchesCountedIn', () => {
  it('is the matches the game counts hold for the half-season', () => {
    expect(matchesCountedIn(COUNTS, 10.5)).toBe(484);
    expect(matchesCountedIn(COUNTS, 10)).toBe(297);
  });

  it('adds up, across half-seasons, to the total Game Stats states', () => {
    const sum = COUNTS.halfSeasons.reduce((total, season) => total + matchesCountedIn(COUNTS, season.halfSeason), 0);

    expect(sum).toBe(COUNTS.matches);
  });

  it('is zero for a half-season with no matches held', () => {
    expect(matchesCountedIn(COUNTS, 11)).toBe(0);
    expect(matchesCountedIn({ ...COUNTS, halfSeasons: [] }, 10.5)).toBe(0);
  });
});
