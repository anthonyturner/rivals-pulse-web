import { deriveOwnDashboard, type OwnDashboardLine } from './own-dashboard';

const HULK = 1011;
const MAGNETO = 1037;
const LUNA = 1031;
const UNKNOWN_HERO = 999_999;

let clock = Date.parse('2026-10-01T12:00:00Z');

/** A match one hour after the last one the spec made, with every figure blank unless given. */
function line(overrides: Partial<OwnDashboardLine> = {}): OwnDashboardLine {
  clock += 60 * 60 * 1000;

  return {
    playedAt: new Date(clock).toISOString(),
    heroId: HULK,
    kills: null,
    deaths: null,
    assists: null,
    finalHits: null,
    isWin: null,
    playModeId: null,
    mapName: null,
    figures: [],
    ...overrides,
  };
}

describe('deriveOwnDashboard', () => {
  describe('with no matches', () => {
    const stats = deriveOwnDashboard([]);

    it('counts nothing and claims no rate', () => {
      expect(stats.activity.maps).toEqual([]);
      expect(stats.matches).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.unknownResults).toBe(0);
      expect(stats.winRate).toBeNull();
      expect(stats.kda).toBeNull();
      expect(stats.finalHits).toBeNull();
      expect(stats.topHeroes).toEqual([]);
      expect(stats.perMinute).toEqual({ damage: null, healing: null, blocked: null });
      expect(stats.records).toEqual({ mostKills: null, mostAssists: null, mostFinalHits: null, longestWinStreak: 0 });
      expect(stats.recent).toEqual([]);
      expect(stats.firstPlayedAt).toBeNull();
      expect(stats.lastPlayedAt).toBeNull();
    });
  });

  describe('results', () => {
    it('counts wins and losses, and takes the win rate over known results only', () => {
      const stats = deriveOwnDashboard([
        line({ isWin: true }),
        line({ isWin: true }),
        line({ isWin: true }),
        line({ isWin: false }),
        line({ isWin: null }),
        line({ isWin: null }),
      ]);

      expect(stats.matches).toBe(6);
      expect(stats.wins).toBe(3);
      expect(stats.losses).toBe(1);
      expect(stats.unknownResults).toBe(2);
      expect(stats.winRate).toBe(0.75);
    });

    it('has no win rate when no result is known, and a rate of 0 when every known one is a loss', () => {
      expect(deriveOwnDashboard([line(), line()]).winRate).toBeNull();
      expect(deriveOwnDashboard([line({ isWin: false }), line()]).winRate).toBe(0);
    });
  });

  describe('kills, deaths and assists', () => {
    it('totals and averages over the matches that recorded all three', () => {
      const kda = deriveOwnDashboard([
        line({ kills: 10, deaths: 2, assists: 4 }),
        line({ kills: 6, deaths: 6, assists: 8 }),
      ]).kda;

      expect(kda).toEqual({
        matches: 2,
        kills: 16,
        deaths: 8,
        assists: 12,
        killsPerMatch: 8,
        deathsPerMatch: 4,
        assistsPerMatch: 6,
        ratio: 3.5,
      });
    });

    it('leaves a match with any of the three blank out of the totals and the averages, not as 0', () => {
      const kda = deriveOwnDashboard([
        line({ kills: 10, deaths: 2, assists: 4 }),
        line({ kills: 8, deaths: null, assists: 3 }),
        line(),
      ]).kda;

      expect(kda?.matches).toBe(1);
      expect(kda?.kills).toBe(10);
      expect(kda?.killsPerMatch).toBe(10);
    });

    it('is null when no match recorded all three', () => {
      expect(deriveOwnDashboard([line({ kills: 3 }), line({ deaths: 1 })]).kda).toBeNull();
    });

    it('does not divide by zero deaths: the ratio is kills plus assists', () => {
      expect(deriveOwnDashboard([line({ kills: 7, deaths: 0, assists: 3 })]).kda?.ratio).toBe(10);
    });

    it('keeps a real 0 kills as a 0', () => {
      const kda = deriveOwnDashboard([line({ kills: 0, deaths: 3, assists: 0 })]).kda;

      expect(kda?.kills).toBe(0);
      expect(kda?.ratio).toBe(0);
    });
  });

  describe('final hits', () => {
    it('totals and averages over the matches that counted them', () => {
      const finalHits = deriveOwnDashboard([line({ finalHits: 4 }), line({ finalHits: 0 }), line({ finalHits: null })]).finalHits;

      expect(finalHits).toEqual({ matches: 2, total: 4, perMatch: 2 });
    });

    it('is null, not 0, when no match counted them', () => {
      expect(deriveOwnDashboard([line(), line()]).finalHits).toBeNull();
    });
  });

  describe('top heroes', () => {
    it('ranks by matches, and gives each hero its own record and KDA', () => {
      const stats = deriveOwnDashboard([
        line({ heroId: HULK, isWin: true, kills: 10, deaths: 5, assists: 5 }),
        line({ heroId: HULK, isWin: false, kills: 5, deaths: 5, assists: 5 }),
        line({ heroId: HULK, isWin: true }),
        line({ heroId: MAGNETO, isWin: false }),
      ]);

      expect(stats.topHeroes.map((hero) => hero.hero)).toEqual(['hulk', 'magneto']);
      expect(stats.topHeroes[0]).toEqual({
        hero: 'hulk',
        matches: 3,
        wins: 2,
        losses: 1,
        winRate: 2 / 3,
        kda: {
          matches: 2,
          kills: 15,
          deaths: 10,
          assists: 10,
          killsPerMatch: 7.5,
          deathsPerMatch: 5,
          assistsPerMatch: 5,
          ratio: 2.5,
        },
      });
      expect(stats.topHeroes[1].winRate).toBe(0);
      expect(stats.topHeroes[1].kda).toBeNull();
    });

    it('counts every id the game gives a hero as that one hero, and ignores a hero it cannot name', () => {
      const stats = deriveOwnDashboard([
        line({ heroId: 1057 }),
        line({ heroId: 10571 }),
        line({ heroId: UNKNOWN_HERO }),
        line({ heroId: null }),
      ]);

      expect(stats.topHeroes).toEqual([jasmine.objectContaining({ hero: 'deadpool', matches: 2 })]);
      expect(stats.matches).toBe(4);
    });

    it('breaks a tie by name, and shows five at most', () => {
      const ids = [1011, 1031, 1037, 1022, 1026, 1033];
      const stats = deriveOwnDashboard(ids.map((heroId) => line({ heroId })));

      expect(stats.topHeroes.length).toBe(5);
      expect(stats.topHeroes.map((hero) => hero.hero)).toEqual([...stats.topHeroes.map((hero) => hero.hero)].sort());
    });

    it('has no win rate for a hero with no known result', () => {
      expect(deriveOwnDashboard([line({ heroId: LUNA })]).topHeroes[0].winRate).toBeNull();
    });
  });

  describe('per minute', () => {
    it('divides each figure by the time it was recorded for, and says how many figures it rests on', () => {
      const perMinute = deriveOwnDashboard([
        line({
          figures: [
            { heroId: HULK, seconds: 300, damage: 3000, healing: null, blocked: 1500 },
            { heroId: MAGNETO, seconds: 300, damage: 1000, healing: 600, blocked: null },
          ],
        }),
        line({ figures: [{ heroId: HULK, seconds: 600, damage: 5000, healing: null, blocked: 4500 }] }),
      ]).perMinute;

      expect(perMinute.damage).toEqual({ perMinute: (9000 / 1200) * 60, samples: 3 });
      expect(perMinute.healing).toEqual({ perMinute: 120, samples: 1 });
      expect(perMinute.blocked).toEqual({ perMinute: (6000 / 900) * 60, samples: 2 });
    });

    it('leaves a figure with no time out of the rate rather than counting it as 0 minutes', () => {
      const perMinute = deriveOwnDashboard([
        line({
          figures: [
            { heroId: HULK, seconds: null, damage: 99_999, healing: null, blocked: null },
            { heroId: HULK, seconds: 0, damage: 99_999, healing: null, blocked: null },
            { heroId: HULK, seconds: 60, damage: 600, healing: null, blocked: null },
          ],
        }),
      ]).perMinute;

      expect(perMinute.damage).toEqual({ perMinute: 600, samples: 1 });
    });

    it('keeps a recorded 0 as a 0 rate', () => {
      const perMinute = deriveOwnDashboard([
        line({ figures: [{ heroId: HULK, seconds: 120, damage: 0, healing: null, blocked: null }] }),
      ]).perMinute;

      expect(perMinute.damage).toEqual({ perMinute: 0, samples: 1 });
    });

    it('is null for a figure no line recorded', () => {
      const perMinute = deriveOwnDashboard([line(), line({ figures: [{ heroId: HULK, seconds: 60, damage: 1, healing: null, blocked: null }] })]).perMinute;

      expect(perMinute.healing).toBeNull();
      expect(perMinute.blocked).toBeNull();
    });
  });

  describe('records', () => {
    it('finds the best match for each, with when and on which hero', () => {
      const best = line({ heroId: MAGNETO, kills: 30, assists: 2, finalHits: 9 });
      const records = deriveOwnDashboard([
        line({ kills: 12, assists: 20, finalHits: 3 }),
        best,
        line({ kills: 2, assists: 4, finalHits: 1 }),
      ]).records;

      expect(records.mostKills).toEqual({ value: 30, playedAt: best.playedAt, hero: 'magneto' });
      expect(records.mostAssists?.value).toBe(20);
      expect(records.mostFinalHits).toEqual({ value: 9, playedAt: best.playedAt, hero: 'magneto' });
    });

    it('gives a tie to the newest match', () => {
      const older = line({ kills: 9 });
      const newer = line({ kills: 9 });

      expect(deriveOwnDashboard([older, newer]).records.mostKills?.playedAt).toBe(newer.playedAt);
    });

    it('has no record for a figure no match recorded, and names no hero it cannot', () => {
      const records = deriveOwnDashboard([line({ kills: 4, heroId: UNKNOWN_HERO })]).records;

      expect(records.mostAssists).toBeNull();
      expect(records.mostFinalHits).toBeNull();
      expect(records.mostKills?.hero).toBeNull();
    });

    it('finds the longest run of wins, oldest to newest, whatever order the lines come in', () => {
      const lines = [true, true, false, true, true, true, false, true].map((isWin) => line({ isWin }));

      expect(deriveOwnDashboard(lines).records.longestWinStreak).toBe(3);
      expect(deriveOwnDashboard([...lines].reverse()).records.longestWinStreak).toBe(3);
    });

    it('ends a streak at a match with no recorded result, because the streak cannot be shown to go on', () => {
      const lines = [true, true, null, true].map((isWin) => line({ isWin }));

      expect(deriveOwnDashboard(lines).records.longestWinStreak).toBe(2);
    });

    it('is 0 with no win', () => {
      expect(deriveOwnDashboard([line({ isWin: false }), line()]).records.longestWinStreak).toBe(0);
    });
  });

  describe('recent matches and the span read', () => {
    it('lists the newest ten first, with a result of win, loss or unknown', () => {
      const lines = Array.from({ length: 12 }, (_, index) => line({ kills: index, isWin: index === 11 ? null : index % 2 === 0 }));
      const stats = deriveOwnDashboard([...lines].reverse());

      expect(stats.recent.length).toBe(10);
      expect(stats.recent.map((match) => match.kills)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
      expect(stats.recent[0].result).toBeNull();
      expect(stats.recent[1].result).toBe('win');
      expect(stats.recent[2].result).toBe('loss');
      expect(stats.firstPlayedAt).toBe(lines[0].playedAt);
      expect(stats.lastPlayedAt).toBe(lines[11].playedAt);
    });

    it('carries the mode, the map and the hero, and leaves a blank as null', () => {
      const [match] = deriveOwnDashboard([
        line({ heroId: LUNA, playModeId: 1, mapName: 'Tokyo 2099', kills: 1, deaths: null, assists: 2, finalHits: null }),
      ]).recent;

      expect(match).toEqual({
        playedAt: jasmine.any(String) as unknown as string,
        hero: 'luna-snow',
        result: null,
        kills: 1,
        deaths: null,
        assists: 2,
        finalHits: null,
        playModeId: 1,
        mapName: 'Tokyo 2099',
      });
    });

    it('does not change the lines it was given', () => {
      const lines = [line({ kills: 1 }), line({ kills: 2 })];
      const before = JSON.stringify(lines);

      deriveOwnDashboard(lines);

      expect(JSON.stringify(lines)).toBe(before);
    });
  });
});
