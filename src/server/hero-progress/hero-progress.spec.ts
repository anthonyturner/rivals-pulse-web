import parity from './hero-progress.parity.json' with { type: 'json' };
import {
  HERO_TIERS,
  UNPLAYED_HERO_PROGRESS,
  buildHeroKeyResolver,
  heroProgress,
  heroProgressTracks,
  heroStarsForLevel,
  heroTierForLevel,
  progressForXp,
  type HeroFigure,
  type HeroProgress,
  type UploadedMatch,
} from './hero-progress';

const HOUR = 60 * 60 * 1000;
const BASE_TIME = 1_753_600_000_000;
const HULK = 1011;
const LUNA_SNOW = 1031;
const DOCTOR_STRANGE = 1018;
const QUICK = 0;
const COMPETITIVE = 1;
const ARCADE = 2;
const PRACTICE = 3;

const stay = (heroId: number, seconds: number | null): HeroFigure => ({ heroId, seconds, damage: null, healing: null, blocked: null });

/** A won ten-minute Competitive match on Hulk: 100 for playing, 100 for the minutes, 50 for a win. */
function hulkMatch(overrides: Partial<UploadedMatch> = {}): UploadedMatch {
  return {
    matchKey: 'm',
    endedAt: BASE_TIME,
    isWin: true,
    playModeId: COMPETITIVE,
    halfSeason: 10,
    heroId: HULK,
    figures: [stay(HULK, 600)],
    ...overrides,
  };
}

describe('hero-progress', () => {
  describe('progressForXp', () => {
    it('starts every hero at level 1 with 0 of 500 XP', () => {
      expect(progressForXp(0)).toEqual({ xp: 0, level: 1, tier: HERO_TIERS[0], xpIntoLevel: 0, xpForLevel: 500 });
      expect(UNPLAYED_HERO_PROGRESS).toEqual(progressForXp(0));
    });

    it('reaches each level at the total the curve names', () => {
      const reaching = (xp: number) => progressForXp(xp).level;

      expect(reaching(499)).toBe(1);
      expect(reaching(500)).toBe(2);
      expect(reaching(1_099)).toBe(2);
      expect(reaching(1_100)).toBe(3);
      expect(reaching(2_599)).toBe(4);
      expect(reaching(2_600)).toBe(5);
      expect(reaching(8_100)).toBe(10);
      expect(reaching(26_600)).toBe(20);
      expect(reaching(142_100)).toBe(50);
      expect(reaching(142_099)).toBe(49);
    });

    it('costs 100 XP more for each level than for the one before', () => {
      expect(progressForXp(500).xpForLevel).toBe(600);
      expect(progressForXp(1_100).xpForLevel).toBe(700);
      expect(progressForXp(8_100).xpForLevel).toBe(1_400);
    });

    it('reports the progress inside the level and keeps counting past level 50 with no cap', () => {
      expect(progressForXp(1_350)).toEqual({ xp: 1_350, level: 3, tier: HERO_TIERS[0], xpIntoLevel: 250, xpForLevel: 700 });
      expect(progressForXp(1_000_000).level).toBeGreaterThan(100);
    });
  });

  describe('hero tiers', () => {
    // The boundary table of the overlay's `hero-progress.spec.ts`, unchanged.
    const BOUNDARIES: readonly (readonly [level: number, tier: string, stars: number])[] = [
      [1, 'Recruit', 0], [4, 'Recruit', 0],
      [5, 'Regular', 0], [9, 'Regular', 0],
      [10, 'Veteran', 0], [19, 'Veteran', 0],
      [20, 'Elite', 0], [34, 'Elite', 0],
      [35, 'Paragon', 0], [49, 'Paragon', 0],
      [50, 'Legend', 0], [74, 'Legend', 0],
      [75, 'Legend', 1], [99, 'Legend', 1],
      [100, 'Legend', 2], [124, 'Legend', 2],
      [125, 'Legend', 3], [300, 'Legend', 10],
      [10_000, 'Legend', 398],
    ];

    it('names the tier and stars at both edges of every band and at a very high level', () => {
      for (const [level, tier, stars] of BOUNDARIES) {
        expect(heroTierForLevel(level).name).withContext(`level ${level}`).toBe(tier);
        expect(heroStarsForLevel(level)).withContext(`stars at ${level}`).toBe(stars);
      }
    });

    it('lists tiers that start at level 1, ascend with no gap in position and have distinct names', () => {
      expect(HERO_TIERS[0].minLevel).toBe(1);
      HERO_TIERS.forEach((tier, index) => {
        expect(Number(tier.key)).toBe(index + 1);
        if (index > 0) expect(tier.minLevel).toBeGreaterThan(HERO_TIERS[index - 1].minLevel);
      });
      expect(new Set(HERO_TIERS.map(tier => tier.name)).size).toBe(HERO_TIERS.length);
    });

    it('always returns a tier, even for a level that is never produced', () => {
      expect(heroTierForLevel(0)).toBe(HERO_TIERS[0]);
      expect(heroTierForLevel(-3)).toBe(HERO_TIERS[0]);
    });

    it('carries the tier on the progress, the one the level falls in', () => {
      expect(progressForXp(0).tier.name).toBe('Recruit');
      expect(progressForXp(26_600).tier.name).toBe('Elite');
      expect(progressForXp(142_099).tier.name).toBe('Paragon');
      expect(progressForXp(142_100).tier.name).toBe('Legend');
      expect(UNPLAYED_HERO_PROGRESS.tier.name).toBe('Recruit');
    });
  });

  describe('heroProgress', () => {
    const xpOf = (matches: readonly UploadedMatch[], slug = 'hulk') => heroProgress(matches).get(slug)?.xp;

    it('gives a won ten-minute match 250 XP (100 for playing, 100 for the minutes, 50 for the win) and 150 more for a first win', () => {
      expect(xpOf([hulkMatch()])).toBe(250 + 150);
    });

    it('adds nothing for a loss or an unknown result', () => {
      for (const isWin of [false, null]) {
        expect(xpOf([hulkMatch({ isWin })])).withContext(String(isWin)).toBe(200);
      }
    });

    it('counts only full minutes', () => {
      expect(xpOf([hulkMatch({ isWin: false, figures: [stay(HULK, 119)] })])).toBe(110);
      expect(xpOf([hulkMatch({ isWin: false, figures: [stay(HULK, 59)] })])).toBe(100);
    });

    it('stops paying for time at 30 minutes', () => {
      expect(xpOf([hulkMatch({ isWin: false, figures: [stay(HULK, 1_800)] })])).toBe(400);
      expect(xpOf([hulkMatch({ isWin: false, figures: [stay(HULK, 7_200)] })])).toBe(400);
    });

    it('still pays for playing when the match has no time on the hero', () => {
      expect(xpOf([hulkMatch({ isWin: false, figures: [{ ...stay(HULK, null), damage: 10 }] })])).toBe(100);
      expect(xpOf([hulkMatch({ isWin: false, figures: [stay(HULK, 45)] })])).toBe(100);
    });

    it('gives a match with no figures to the hero on the account\'s own line, with no time', () => {
      expect(xpOf([hulkMatch({ isWin: false, figures: [] })])).toBe(100);
      expect(heroProgress([hulkMatch({ figures: [], heroId: null })]).size).toBe(0);
    });

    it('counts Quick Match and Competitive and nothing else', () => {
      const counted = [hulkMatch({ matchKey: 'a', playModeId: COMPETITIVE }), hulkMatch({ matchKey: 'b', playModeId: QUICK })];
      const ignored = [ARCADE, PRACTICE, -1, null].map((playModeId, index) => hulkMatch({ matchKey: `x${index}`, playModeId }));

      expect(xpOf([...counted, ...ignored])).toBe(250 + 150 + 250);
      expect(heroProgress(ignored).size).toBe(0);
    });

    it('adds up every match in every season', () => {
      const seasons = [8, 9, 10].map(halfSeason => hulkMatch({ matchKey: `s${halfSeason}`, halfSeason }));

      expect(xpOf(seasons)).toBe(750 + 150);
    });

    it('gives the same XP and level for the same matches in any order', () => {
      const matches = Array.from({ length: 12 }, (_, index) =>
        hulkMatch({
          matchKey: `m${index}`,
          isWin: index % 3 !== 0,
          figures: [stay(index % 4 === 0 ? DOCTOR_STRANGE : HULK, 60 * (index + 1))],
        }),
      );
      const expected = heroProgress(matches);
      const reversed = heroProgress([...matches].reverse());
      const rotated = heroProgress([...matches.slice(5), ...matches.slice(0, 5)]);

      expect([...reversed]).toEqual(jasmine.arrayWithExactContents([...expected]));
      expect([...rotated]).toEqual(jasmine.arrayWithExactContents([...expected]));
      expect(expected.size).toBe(2);
    });

    it('credits each hero played in a match with the time on that hero, and a win to both', () => {
      const progress = heroProgress([hulkMatch({ figures: [stay(HULK, 240), stay(LUNA_SNOW, 360)] })]);

      expect(progress.get('hulk')?.xp).toBe(100 + 40 + 50 + 150);
      expect(progress.get('luna-snow')?.xp).toBe(100 + 60 + 50 + 150);
    });

    it('counts a hero played twice in one match once, with both stays added (390 seconds is six full minutes)', () => {
      const returned = hulkMatch({ isWin: false, figures: [stay(HULK, 200), stay(LUNA_SNOW, 200), stay(HULK, 190)] });

      expect(heroProgress([returned]).get('hulk')?.xp).toBe(100 + 60);
    });

    it('counts a short stay only when the hero did something, and leaves out a hero the site does not know', () => {
      const progress = heroProgress([
        hulkMatch({
          isWin: false,
          figures: [
            { ...stay(HULK, 29), damage: 0, healing: 0, blocked: 0 },
            { ...stay(LUNA_SNOW, 29), healing: 1 },
            { ...stay(DOCTOR_STRANGE, 29), blocked: 5 },
            { ...stay(9_999, 600), damage: 500 },
          ],
        }),
      ]);

      expect([...progress.keys()]).toEqual(jasmine.arrayWithExactContents(['luna-snow', 'doctor-strange']));
    });

    describe('Deadpool, whose role forms are separate heroes', () => {
      const deadpool = (heroId: number, matchKey: string, overrides: Partial<UploadedMatch> = {}) =>
        hulkMatch({ matchKey, isWin: false, heroId, figures: [], ...overrides });

      it('keeps a level for each role form', () => {
        const progress = heroProgress([
          deadpool(10571, 'a'),
          deadpool(10572, 'b'),
          deadpool(10572, 'c'),
          deadpool(10573, 'd', { isWin: true }),
        ]);

        expect([...progress.keys()]).toEqual(jasmine.arrayWithExactContents(['deadpool:Vanguard', 'deadpool:Duelist', 'deadpool:Strategist']));
        expect(progress.get('deadpool:Vanguard')?.xp).toBe(100);
        expect(progress.get('deadpool:Duelist')?.xp).toBe(200);
        expect(progress.get('deadpool:Strategist')?.xp).toBe(150 + 150);
      });

      it('credits each form separately when a match swaps between them, once each', () => {
        const swap = hulkMatch({ isWin: false, figures: [stay(10571, 120), stay(10572, 180), stay(10571, 60)] });

        const progress = heroProgress([swap]);

        expect(progress.get('deadpool:Vanguard')?.xp).toBe(100 + 30);
        expect(progress.get('deadpool:Duelist')?.xp).toBe(100 + 30);
      });

      it('gives the base id, which names no role form, to no form', () => {
        expect(heroProgress([deadpool(1057, 'a')]).size).toBe(0);
      });
    });

    describe('first-win and rested bonuses', () => {
      /** A ten-minute Hulk match that ends `hoursIn` hours after the default one; a loss unless it is told to win. */
      const at = (matchKey: string, hoursIn: number, isWin = false, overrides: Partial<UploadedMatch> = {}) =>
        hulkMatch({ matchKey, isWin, endedAt: BASE_TIME + hoursIn * HOUR, ...overrides });

      it('adds 150 for a first win and 100 for the first match after a 2-hour break, and both on one match', () => {
        expect(xpOf([at('a', 0, true)])).toBe(250 + 150);
        expect(xpOf([at('a', 0), at('b', 3)])).toBe(200 + 200 + 100);
        expect(xpOf([at('a', 0), at('b', 24, true)])).toBe(200 + 250 + 150 + 100);
      });

      it('gives a second win soon after the first nothing extra', () => {
        expect(xpOf([at('a', 0, true), at('b', 1, true)])).toBe(250 + 150 + 250);
      });

      it('follows the whole run of matches, not one hero: a win on another hero used up the bonus', () => {
        const strange = at('a', 0, true, { heroId: DOCTOR_STRANGE, figures: [stay(DOCTOR_STRANGE, 600)] });
        const progress = heroProgress([strange, at('b', 1, true)]);

        expect(progress.get('doctor-strange')?.xp).toBe(250 + 150);
        expect(progress.get('hulk')?.xp).toBe(250);
      });

      it('leaves a match that is not counted out of the gaps as well as the totals', () => {
        const practice = at('p', 1, true, { playModeId: PRACTICE });

        expect(xpOf([at('a', 0), practice, at('b', 2.5, true)])).toBe(200 + 250 + 150 + 100);
      });

      it('lowers the XP when a match is deleted and gives the same XP back when it is restored', () => {
        const history = [at('a', 0, true), at('b', 24, true), at('c', 48)];
        const withoutB = history.filter(({ matchKey }) => matchKey !== 'b');

        expect(xpOf(history)).toBe(400 + 500 + 300);
        expect(xpOf(withoutB)).toBe(400 + 300);
        expect(xpOf([...withoutB, history[1]])).toBe(xpOf(history));
      });

      it('passes the first-win bonus on to the next win when the win that held it is deleted', () => {
        expect(xpOf([at('a', 0, true), at('b', 1, true)])).toBe(400 + 250);
        expect(xpOf([at('b', 1, true)])).toBe(400);
      });
    });

    describe('the season track', () => {
      const inSeason = (halfSeason: number, matchKey: string, hoursIn: number, isWin = false) =>
        hulkMatch({ matchKey, halfSeason, isWin, endedAt: BASE_TIME + hoursIn * HOUR });
      const matches = [inSeason(9, 'old', 0, true), inSeason(10, 'a', 30, true), inSeason(10, 'b', 31), inSeason(10, 'c', 80, true)];

      it('counts only the half-season it is given, and the all-time level counts them all', () => {
        expect(heroProgress(matches, 10).get('hulk')?.xp).toBe(250 + 150 + 200 + 250 + 150 + 100);
        expect(heroProgress(matches).get('hulk')?.xp).toBe(250 + 150 + (250 + 150 + 100) + 200 + (250 + 150 + 100));
      });

      it('has no entry for a hero with no match in the season, so a new season starts from level 1', () => {
        expect(heroProgress(matches, 11).size).toBe(0);
      });

      it('works the bonuses out inside the season: its first match is no rested one, and its first win earns the first-win bonus', () => {
        expect(heroProgress([inSeason(9, 'old', 0, true), inSeason(10, 'a', 1, true)], 10).get('hulk')?.xp).toBe(250 + 150);
      });

      it('keeps half-season 10.5 apart from 10', () => {
        expect(heroProgress([inSeason(10, 'a', 0), inSeason(10.5, 'b', 1)], 10.5).get('hulk')?.xp).toBe(200);
      });

      it('leaves a match with no half-season out of every season track and keeps it in the all-time one', () => {
        const unplaced = hulkMatch({ matchKey: 'u', halfSeason: null });

        expect(heroProgressTracks([unplaced]).allTime.get('hulk')?.xp).toBe(400);
        expect(heroProgressTracks([unplaced]).byHalfSeason.size).toBe(0);
      });
    });

    describe('how existing all-time levels change', () => {
      /** The XP a match gave before the bonuses: 100 for playing, 100 for ten minutes, 50 for a win. */
      const xpBefore = (matches: readonly UploadedMatch[]) => matches.reduce((total, { isWin }) => total + 200 + (isWin ? 50 : 0), 0);
      const session = (day: number, results: readonly boolean[]) =>
        results.map((isWin, index) => hulkMatch({ matchKey: `d${day}m${index}`, isWin, endedAt: BASE_TIME + day * 24 * HOUR + index * HOUR }));
      // Ten days of one session a day: a win, a loss and a win an hour apart, all on Hulk.
      const tenDays = Array.from({ length: 10 }, (_, day) => session(day, [true, false, true])).flat();

      it('lifts a player with a session every day by 250 XP a day, here from level 9 to level 10', () => {
        expect(xpBefore(tenDays)).toBe(7_000);
        expect(progressForXp(xpBefore(tenDays)).level).toBe(9);

        expect(xpOf(tenDays)).toBe(7_000 + 10 * 150 + 9 * 100);
        expect(heroProgress(tenDays).get('hulk')?.level).toBe(10);
      });

      it('lifts a weekly player by 250 XP a match, since each match is a first win after a break', () => {
        const weekly = Array.from({ length: 8 }, (_, week) => session(week * 7, [true])).flat();

        expect(xpOf(weekly)).toBe(xpBefore(weekly) + 8 * 150 + 7 * 100);
      });

      it('never gives a hero less XP than before, at any point in the history', () => {
        for (let count = 1; count <= tenDays.length; count++) {
          const sofar = tenDays.slice(0, count);

          expect(xpOf(sofar) as number).toBeGreaterThanOrEqual(xpBefore(sofar));
        }
      });
    });

    it('has no entry for a hero that was never played', () => {
      expect(heroProgress([hulkMatch()]).has('thor')).toBeFalse();
      expect(heroProgress([]).size).toBe(0);
    });
  });

  describe('buildHeroKeyResolver', () => {
    const resolve = buildHeroKeyResolver([
      { id: 'hulk', gameId: 1011 },
      { id: 'deadpool', gameId: 1057, gameIdVariants: [{ gameId: 10571, role: 'Vanguard' }, { gameId: 10572 }] },
    ]);

    it('keys a hero by its slug and a role form by slug and role', () => {
      expect(resolve(1011)).toBe('hulk');
      expect(resolve(10571)).toBe('deadpool:Vanguard');
    });

    it('gives no key to a base id with role forms, a form with no role or an unknown id', () => {
      expect(resolve(1057)).toBeNull();
      expect(resolve(10572)).toBeNull();
      expect(resolve(9_999)).toBeNull();
    });
  });

  describe('heroProgressTracks', () => {
    it('gives the all-time track and one track for each half-season with a counted match, newest first', () => {
      const tracks = heroProgressTracks([
        hulkMatch({ matchKey: 'a', halfSeason: 9 }),
        hulkMatch({ matchKey: 'b', halfSeason: 10.5 }),
        hulkMatch({ matchKey: 'c', halfSeason: 10, playModeId: PRACTICE }),
      ]);

      expect([...tracks.byHalfSeason.keys()]).toEqual([10.5, 9]);
      expect(tracks.allTime.get('hulk')?.xp).toBe(250 + 150 + 250);
    });
  });

  describe('parity with the overlay', () => {
    // The fixtures are the shared contract: the overlay's `hero-progress.ts` and `hero-xp-bonuses.ts` give these totals for
    // these matches (`hero-progress.parity.json`, worked out from the overlay's own bonus file and formula).
    type Expected = Record<string, { xp: number; level: number; tier: string; stars: number }>;
    const summarise = (progress: ReadonlyMap<string, HeroProgress>) =>
      Object.fromEntries(
        [...progress]
          .sort(([first], [second]) => (first < second ? -1 : 1))
          .map(([key, { xp, level, tier }]) => [key, { xp, level, tier: tier.name, stars: heroStarsForLevel(level) }]),
      );

    for (const account of parity.accounts) {
      describe(account.name, () => {
        const matches = account.matches as unknown as UploadedMatch[];

        it('gives each hero the XP, level, tier and stars the overlay gives, all-time', () => {
          expect(summarise(heroProgress(matches))).toEqual(account.expected.allTime as unknown as Expected);
        });

        it('gives the same in each half-season, with the bonuses worked out inside it', () => {
          const tracks = heroProgressTracks(matches).byHalfSeason;
          const seasons = Object.fromEntries([...tracks].map(([halfSeason, progress]) => [String(halfSeason), summarise(progress)]));

          expect(seasons).toEqual(account.expected.halfSeasons as unknown as Record<string, Expected>);
        });
      });
    }

    it('covers a Veteran and an Elite level and a role form', () => {
      const tiers = new Set(parity.accounts.flatMap(({ expected }) => Object.values(expected.allTime).map(({ tier }) => tier)));

      expect(tiers.has('Veteran')).toBeTrue();
      expect(tiers.has('Elite')).toBeTrue();
      expect(Object.keys(parity.accounts[0].expected.allTime)).toContain('deadpool:Duelist');
    });
  });
});
