import {
  COMMUNITY_FIGURES_MINIMUMS,
  deriveCommunityFigures,
  perMinute,
  type CommunityFiguresSource,
  type HeroFigureRow,
} from './community-figures';
import type { CommunityFigures } from './contracts/community-figures.model';
import type { HeroRole } from './contracts/role-stats.model';
import { PLAY_MODE_IDS } from './hero-stats';

const NOW = new Date('2026-10-30T12:00:00Z');
const { roleLines, heroLines } = COMMUNITY_FIGURES_MINIMUMS;

const HALF_SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];

const ROLE_BY_GAME_ID = new Map<number, HeroRole>([
  [1, 'Vanguard'],
  [2, 'Vanguard'],
  [3, 'Duelist'],
  [4, 'Strategist'],
  [41, 'Strategist'],
]);
const SLUG_BY_GAME_ID = new Map<number, string>([
  [1, 'hulk'],
  [2, 'thor'],
  [3, 'hela'],
  [4, 'luna-snow'],
  [41, 'luna-snow'],
]);
const OPTIONS = { now: NOW, roleByGameId: ROLE_BY_GAME_ID, heroSlugByGameId: SLUG_BY_GAME_ID };

/** A row where all three figures were carried by `lines` lines over `seconds` seconds of play. */
function row(gameHeroId: number, lines: number, seconds: number, figures: Partial<HeroFigureRow> = {}): HeroFigureRow {
  return {
    halfSeason: 10.5,
    playModeId: PLAY_MODE_IDS.competitive,
    gameHeroId,
    damageSum: 0,
    damageN: lines,
    damageSeconds: seconds,
    healingSum: 0,
    healingN: lines,
    healingSeconds: seconds,
    blockedSum: 0,
    blockedN: lines,
    blockedSeconds: seconds,
    ...figures,
  };
}

function derive(figures: HeroFigureRow[], extra: { halfSeason?: number } = {}): CommunityFigures {
  const source: CommunityFiguresSource = { halfSeasons: HALF_SEASONS, figures };

  return deriveCommunityFigures(source, { ...OPTIONS, ...extra }).figures;
}

function allMode(result: CommunityFigures) {
  return result.modes[0];
}

describe('perMinute', () => {
  it('is the sum over the seconds, times sixty', () => {
    expect(perMinute(6000, 600)).toBe(600);
    expect(perMinute(15000, 2400)).toBe(375);
    expect(perMinute(90, 60)).toBe(90);
  });

  it('keeps a real zero: a support who dealt no damage dealt 0 per minute', () => {
    expect(perMinute(0, 600)).toBe(0);
  });

  it('has no rate without time played, never infinity or NaN', () => {
    expect(perMinute(500, 0)).toBeNull();
    expect(perMinute(500, -30)).toBeNull();
    expect(perMinute(Number.NaN, 600)).toBeNull();
    expect(perMinute(500, Number.NaN)).toBeNull();
    expect(perMinute(Number.POSITIVE_INFINITY, 600)).toBeNull();
  });
});

describe('deriveCommunityFigures', () => {
  it('is the designed empty state when nothing has been counted', () => {
    const result = derive([]);

    expect(result.status).toBe('not-enough-data');
    expect(result.minimums).toEqual({ ...COMMUNITY_FIGURES_MINIMUMS });
    expect(result.modes.map((mode) => mode.id)).toEqual(['all', 'quick-match', 'competitive', 'arcade', 'practice']);
    expect(allMode(result).roles.map((entry) => entry.role)).toEqual(['Vanguard', 'Duelist', 'Strategist']);
    expect(
      allMode(result).roles.every((entry) => entry.damage === null && entry.healing === null && entry.blocked === null),
    ).toBeTrue();
    expect(allMode(result).heroes).toEqual([]);
  });

  it('is empty before any half-season exists', () => {
    const result = deriveCommunityFigures({ halfSeasons: [], figures: [] }, OPTIONS).figures;

    expect(result.status).toBe('not-enough-data');
    expect(result.halfSeason).toBeNull();
    expect(result.halfSeasons).toEqual([]);
  });

  describe('a role is pooled, not averaged', () => {
    it('adds the sums and the seconds of its heroes before it divides', () => {
      // Hulk 12000 damage in 600 s (1200 a minute), Thor 3000 in 1800 s (100 a minute): pooled that
      // is 15000 in 2400 s, 375 a minute. The mean of the two rates, 650, would be wrong.
      const result = derive([
        row(1, roleLines, 600, { damageSum: 12000 }),
        row(2, roleLines, 1800, { damageSum: 3000 }),
      ]);

      expect(allMode(result).roles[0]).toEqual({ role: 'Vanguard', damage: 375, healing: 0, blocked: 0 });
    });

    it('rounds to a whole number', () => {
      const result = derive([row(3, roleLines, 700, { damageSum: 1000 })]);

      expect(allMode(result).roles[1].damage).toBe(86);
    });

    it('sums rows from the same hero in different modes of the blend', () => {
      const result = derive([
        row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.competitive, damageSum: 6000 }),
        row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.quickMatch, damageSum: 12000 }),
      ]);

      expect(allMode(result).roles[1].damage).toBe(900);
    });
  });

  describe('minimums count the lines that carry the figure', () => {
    it('shows a role figure at its minimum and not one line below', () => {
      const below = derive([row(1, roleLines - 1, 600, { damageSum: 6000 })]);
      const at = derive([row(1, roleLines, 600, { damageSum: 6000 })]);

      expect(allMode(below).roles[0].damage).toBeNull();
      expect(allMode(at).roles[0].damage).toBe(600);
    });

    it('judges each figure on its own lines, so an older app that sent no healing leaves healing empty', () => {
      const result = derive([
        row(1, roleLines, 600, { damageSum: 6000, healingN: 0, healingSum: 0, healingSeconds: 0 }),
      ]);

      expect(allMode(result).roles[0]).toEqual({ role: 'Vanguard', damage: 600, healing: null, blocked: 0 });
    });

    it('does not count a missing figure as zero: lines without it are not in the rate at all', () => {
      // 50 lines carry damage (6000 in 600 s). A second row whose lines carried none adds nothing,
      // neither damage nor seconds, so the rate stays 600 a minute.
      const result = derive([
        row(1, roleLines, 600, { damageSum: 6000 }),
        row(2, 0, 0, { damageN: 0, damageSum: 0, damageSeconds: 0 }),
      ]);

      expect(allMode(result).roles[0].damage).toBe(600);
    });

    it('has no rate for lines that carry a figure but no time played', () => {
      const result = derive([row(1, roleLines, 0, { damageSum: 6000 })]);

      expect(allMode(result).roles[0].damage).toBeNull();
    });

    it('applies the hero minimum to a hero, which is lower than a role needs', () => {
      expect(heroLines).toBeLessThan(roleLines);

      const result = derive([
        row(3, heroLines, 600, { damageSum: 6000 }),
        row(4, heroLines - 1, 600, { healingSum: 6000 }),
      ]);

      expect(allMode(result).heroes).toEqual([{ hero: 'hela', damage: 600, healing: 0, blocked: 0 }]);
      expect(allMode(result).roles[2].healing).toBeNull();
    });

    it('leaves out a hero with no figure to show', () => {
      const result = derive([row(3, heroLines - 1, 600, { damageSum: 6000 })]);

      expect(allMode(result).heroes).toEqual([]);
      expect(result.status).toBe('not-enough-data');
    });
  });

  describe('what the database hid', () => {
    it('is a figure with no lines: it reads as not enough data and shows no number', () => {
      // The database sends a hidden figure as zero sum, zero lines and zero seconds.
      const result = derive([
        row(3, roleLines, 600, {
          damageSum: 0,
          damageN: 0,
          damageSeconds: 0,
          healingSum: 9000,
          healingSeconds: 600,
        }),
      ]);

      expect(allMode(result).roles[1].damage).toBeNull();
      expect(allMode(result).roles[1].healing).toBe(900);
    });
  });

  describe('modes', () => {
    const rows = [
      row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.quickMatch, damageSum: 6000 }),
      row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.competitive, damageSum: 12000 }),
      row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.arcade, damageSum: 30000 }),
      row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.practice, damageSum: 60000 }),
      row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.unknown, damageSum: 90000 }),
    ];

    it('blends Quick Match and Competitive for the default and counts each other mode alone', () => {
      const result = derive(rows);
      const damage = (id: string) => result.modes.find((mode) => mode.id === id)?.roles[1].damage;

      expect(damage('all')).toBe(900);
      expect(damage('quick-match')).toBe(600);
      expect(damage('competitive')).toBe(1200);
      expect(damage('arcade')).toBe(3000);
      expect(damage('practice')).toBe(6000);
    });

    it('leaves a match with no recorded mode out of every mode', () => {
      const result = derive([row(3, roleLines, 600, { playModeId: PLAY_MODE_IDS.unknown, damageSum: 90000 })]);

      expect(result.status).toBe('not-enough-data');
    });
  });

  describe('heroes', () => {
    it('merges the game ids a hero answers to and orders heroes by id', () => {
      const result = derive([
        row(4, 6, 300, { healingSum: 3000 }),
        row(41, 6, 300, { healingSum: 3000 }),
        row(3, heroLines, 600, { damageSum: 6000 }),
      ]);

      expect(allMode(result).heroes.map((entry) => entry.hero)).toEqual(['hela', 'luna-snow']);
      expect(allMode(result).heroes[1].healing).toBe(600);
    });

    it('leaves a game hero id with no hero out of the numbers and reports it', () => {
      const derivation = deriveCommunityFigures(
        { halfSeasons: HALF_SEASONS, figures: [row(0, roleLines, 600, { damageSum: 6000 })] },
        OPTIONS,
      );

      expect(derivation.excludedGameIds).toEqual([0]);
      expect(derivation.figures.status).toBe('not-enough-data');
    });

    it('leaves a hero with no role out of the role figures but keeps it as a hero', () => {
      const withoutRole = { ...OPTIONS, roleByGameId: new Map<number, HeroRole>() };
      const result = deriveCommunityFigures(
        { halfSeasons: HALF_SEASONS, figures: [row(3, heroLines, 600, { damageSum: 6000 })] },
        withoutRole,
      ).figures;

      expect(allMode(result).heroes).toEqual([{ hero: 'hela', damage: 600, healing: 0, blocked: 0 }]);
      expect(allMode(result).roles.every((entry) => entry.damage === null)).toBeTrue();
    });
  });

  describe('half-seasons', () => {
    it('shows the current half-season when it has a figure', () => {
      const result = derive([
        row(3, roleLines, 600, { halfSeason: 10, damageSum: 6000 }),
        row(3, roleLines, 600, { damageSum: 12000 }),
      ]);

      expect(result.halfSeason?.id).toBe(10.5);
      expect(result.inPlaceOf).toBeNull();
      expect(allMode(result).roles[1].damage).toBe(1200);
    });

    it('stands the previous half-season in while the current one has no figure yet', () => {
      const result = derive([
        row(3, roleLines, 600, { halfSeason: 10, damageSum: 6000 }),
        row(3, heroLines - 1, 600, { damageSum: 12000 }),
      ]);

      expect(result.halfSeason?.id).toBe(10);
      expect(result.inPlaceOf?.id).toBe(10.5);
      expect(allMode(result).roles[1].damage).toBe(600);
    });

    it('shows exactly the half-season asked for, with no fall-back', () => {
      const rows = [row(3, roleLines, 600, { halfSeason: 10, damageSum: 6000 })];

      expect(derive(rows, { halfSeason: 10 }).halfSeason?.id).toBe(10);
      expect(derive(rows, { halfSeason: 10.5 }).status).toBe('not-enough-data');
      expect(derive(rows, { halfSeason: 11 }).halfSeason).toBeNull();
    });
  });

  describe('the public payload', () => {
    const ready = derive([
      row(1, roleLines, 600, { damageSum: 6000, healingSum: 60, blockedSum: 30000 }),
      row(3, 400, 3600, { damageSum: 99_000 }),
    ]);

    it('is ready with figures', () => {
      expect(ready.status).toBe('ready');
    });

    it('publishes only the allow-listed keys, with no name, id, count or per-player field anywhere', () => {
      expect(Object.keys(ready).sort()).toEqual(['halfSeason', 'halfSeasons', 'inPlaceOf', 'minimums', 'modes', 'status']);
      expect(Object.keys(ready.minimums).sort()).toEqual(['heroLines', 'recorders', 'roleLines']);
      expect(Object.keys(ready.halfSeason!).sort()).toEqual(['endsAt', 'id', 'label', 'startsAt']);
      expect(Object.keys(ready.modes[0]).sort()).toEqual(['heroes', 'id', 'label', 'roles']);
      expect(Object.keys(ready.modes[0].roles[0]).sort()).toEqual(['blocked', 'damage', 'healing', 'role']);
      expect(Object.keys(ready.modes[0].heroes[0]).sort()).toEqual(['blocked', 'damage', 'healing', 'hero']);
      expect(JSON.stringify(ready)).not.toMatch(/uid|fingerprint|recorded|segments|"[a-z]+N"/);
    });

    it('publishes whole numbers, and no line or second count', () => {
      const numbers: number[] = [];
      walk(ready, (key, value) => {
        if (typeof value === 'number' && !['id', 'recorders', 'roleLines', 'heroLines'].includes(key)) {
          numbers.push(value);
        }
      });

      expect(numbers.every(Number.isInteger)).toBeTrue();
      // 400 lines and 3600 seconds went in; neither comes out.
      expect(numbers).not.toContain(400);
      expect(numbers).not.toContain(3600);
    });

    it('serialises without NaN or infinity anywhere', () => {
      const numbers: number[] = [];
      walk(ready, (_key, value) => {
        if (typeof value === 'number') {
          numbers.push(value);
        }
      });

      expect(numbers.every(Number.isFinite)).toBeTrue();
    });
  });
});

function walk(value: unknown, visit: (key: string, value: unknown) => void, key = ''): void {
  visit(key, value);

  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit, key));
  } else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([childKey, child]) => walk(child, visit, childKey));
  }
}
