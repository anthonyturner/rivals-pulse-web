import type { StrategistTag } from '../../../contracts/strategist-tags.model.ts';
import { strategistTagByGameId } from '../catalog/strategist-tags';
import {
  TRIPLE_SUPPORT_MIN_MATCHES,
  deriveTripleSupportTrios,
  variantOf,
  type TripleSupportRow,
} from './triple-support-trios';

const NOW = new Date('2026-11-07T12:00:00Z');
const MANTIS = 1020;
const ADAM = 1046;
const ULTRON = 1028;
const LUNA = 1031;
const LOKI = 1016;
const ROCKET = 1023;
const CLOAK = 1025;
const SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];
const TAGS = new Map<number, StrategistTag>([
  [MANTIS, 'utility'],
  [ADAM, 'utility'],
  [ULTRON, 'utility'],
  [LUNA, 'healer'],
  [LOKI, 'healer'],
  [ROCKET, 'healer'],
  [CLOAK, 'healer'],
]);
const NAMES = new Map<number, string>([
  [MANTIS, 'Mantis'],
  [ADAM, 'Adam Warlock'],
  [ULTRON, 'Ultron'],
]);

const SLUGS = new Map<number, string>([
  [MANTIS, 'mantis'],
  [ADAM, 'adam-warlock'],
  [ULTRON, 'ultron'],
  [LUNA, 'luna-snow'],
  [LOKI, 'loki'],
  [ROCKET, 'rocket-raccoon'],
  [CLOAK, 'cloak-and-dagger'],
]);

function row(heroes: [number, number, number], matches: number, extra: Partial<TripleSupportRow> = {}): TripleSupportRow {
  const [heroA, heroB, heroC] = [...heroes].sort((a, b) => a - b);

  return {
    halfSeason: 10.5,
    rankBucket: -1,
    heroA,
    heroB,
    heroC,
    matches,
    teams: matches,
    wins: Math.floor(matches / 2),
    classifiedTeams: 200,
    unclassifiedTeams: 14,
    fourPlusTeams: 3,
    ...extra,
  };
}

const TOTALS = [
  { halfSeason: 10.5, playModeId: 0, decidedMatches: 40 },
  { halfSeason: 10.5, playModeId: 1, decidedMatches: 60 },
];

function derive(
  rows: TripleSupportRow[],
  names: ReadonlyMap<number, string> = NAMES,
  options: { halfSeason?: number; mode?: string; slugs?: ReadonlyMap<number, string> } = {},
) {
  return deriveTripleSupportTrios(
    rows,
    { halfSeasons: SEASONS, totals: TOTALS },
    { now: NOW, tagByGameId: TAGS, nameByGameId: names, slugByGameId: options.slugs ?? SLUGS, ...options },
  );
}

describe('variantOf', () => {
  it('names a trio for its one utility hero', () => {
    expect(variantOf([LUNA, MANTIS, ROCKET], TAGS, NAMES)).toEqual({ label: 'Mantis triple', anchorHeroIds: [MANTIS] });
    expect(variantOf([ADAM, LUNA, LOKI], TAGS, NAMES)).toEqual({ label: 'Adam Warlock triple', anchorHeroIds: [ADAM] });
    expect(variantOf([ULTRON, LUNA, CLOAK], TAGS, NAMES)).toEqual({ label: 'Ultron triple', anchorHeroIds: [ULTRON] });
  });

  it('names a trio for two utility heroes by display name in alphabetical order, not the order of the ids', () => {
    expect(variantOf([MANTIS, ADAM, LUNA], TAGS, NAMES)).toEqual({
      label: 'Adam Warlock + Mantis triple',
      anchorHeroIds: [ADAM, MANTIS],
    });
    expect(variantOf([ULTRON, MANTIS, LUNA], TAGS, NAMES)).toEqual(jasmine.objectContaining({ label: 'Mantis + Ultron triple' }));
  });

  it('names a trio for all three utility heroes', () => {
    expect(variantOf([ULTRON, ADAM, MANTIS], TAGS, NAMES)).toEqual({
      label: 'Adam Warlock + Mantis + Ultron triple',
      anchorHeroIds: [ADAM, MANTIS, ULTRON],
    });
  });

  it('calls a trio with no utility hero three healers, whoever the healers are', () => {
    expect(variantOf([LUNA, LOKI, CLOAK], TAGS, NAMES)).toEqual({ label: 'Three healers', anchorHeroIds: [] });
  });

  it('names a trio once for a utility hero who is on the team twice', () => {
    expect(variantOf([MANTIS, MANTIS, LUNA], TAGS, NAMES)).toEqual(jasmine.objectContaining({ label: 'Mantis triple' }));
  });

  it('cannot name a trio with an untagged hero, or a utility hero with no name, and says which', () => {
    expect(variantOf([LUNA, LOKI, 1999], TAGS, NAMES)).toEqual({ unnamed: [1999] });
    expect(variantOf([MANTIS, LUNA, LOKI], TAGS, new Map())).toEqual({ unnamed: [MANTIS] });
  });
});

describe('the committed Strategist tags', () => {
  it('make Mantis, Adam Warlock and Ultron utility and every other Strategist a healer', () => {
    const utility = [...strategistTagByGameId].filter(([, tag]) => tag === 'utility').map(([gameId]) => gameId);
    const healers = [...strategistTagByGameId].filter(([, tag]) => tag === 'healer').map(([gameId]) => gameId);

    expect(utility.sort()).toEqual([MANTIS, ULTRON, ADAM]);
    expect(healers).toContain(LOKI);
    expect(healers).toContain(1060);
    expect(healers).toContain(1057);
  });
});

describe('deriveTripleSupportTrios', () => {
  it('keeps the minimum at the 10 matches the database enforces', () => {
    expect(TRIPLE_SUPPORT_MIN_MATCHES).toBe(10);
    expect(derive([]).trios.minimumMatches).toBe(10);
  });

  it('is the empty state with no row, with zero counts', () => {
    const { trios } = derive([]);

    expect(trios.status).toBe('not-enough-data');
    expect(trios.trios).toEqual([]);
    expect([trios.classifiedTeams, trios.unclassifiedTeams, trios.fourPlusTeams]).toEqual([0, 0, 0]);
    expect(trios.halfSeason?.id).toBe(10.5);
  });

  it('lists a trio with its heroes, variant, counts and share of the classified teams', () => {
    const { trios } = derive([row([MANTIS, LUNA, ROCKET], 20, { teams: 24, wins: 15 })]);

    expect(trios.status).toBe('ready');
    expect(trios.trios).toEqual([
      {
        heroIds: [MANTIS, LUNA, ROCKET].sort((a, b) => a - b) as [number, number, number],
        heroes: ['mantis', 'rocket-raccoon', 'luna-snow'],
        variant: { label: 'Mantis triple', anchorHeroIds: [MANTIS] },
        matches: 20,
        teams: 24,
        wins: 15,
        share: 0.12,
      },
    ]);
    expect([trios.classifiedTeams, trios.unclassifiedTeams, trios.fourPlusTeams]).toEqual([200, 14, 3]);
  });

  it('lists the most played trio first and breaks a tie by hero ids', () => {
    const { trios } = derive([
      row([ADAM, LUNA, LOKI], 12),
      row([LUNA, LOKI, CLOAK], 30),
      row([MANTIS, LUNA, LOKI], 12),
    ]);

    expect(trios.trios.map((trio) => trio.variant.label)).toEqual(['Three healers', 'Mantis triple', 'Adam Warlock triple']);
  });

  it('leaves out a trio below the minimum even if the database let it through', () => {
    const { trios } = derive([row([MANTIS, LUNA, LOKI], 9), row([ADAM, LUNA, LOKI], 10)]);

    expect(trios.trios.map((trio) => trio.variant.label)).toEqual(['Adam Warlock triple']);
  });

  it('leaves out, and reports, a trio with a Strategist that has no tag', () => {
    const { trios, unnamedGameIds } = derive([row([MANTIS, LUNA, 1999], 40), row([ADAM, LUNA, LOKI], 12)]);

    expect(trios.trios.map((trio) => trio.variant.label)).toEqual(['Adam Warlock triple']);
    expect(unnamedGameIds).toEqual([1999]);
  });

  it('leaves out, and reports, a trio with a utility hero that has no name', () => {
    const { trios, unnamedGameIds } = derive([row([MANTIS, LUNA, LOKI], 40), row([LUNA, LOKI, CLOAK], 12)], new Map());

    expect(trios.trios.map((trio) => trio.variant.label)).toEqual(['Three healers']);
    expect(unnamedGameIds).toEqual([MANTIS]);
  });

  it('leaves out, and reports, a trio with a Strategist that has no hero id in heroes.json', () => {
    const slugs = new Map(SLUGS);

    slugs.delete(LOKI);

    const { trios, unnamedGameIds } = derive([row([MANTIS, LUNA, LOKI], 40), row([ADAM, LUNA, CLOAK], 12)], NAMES, { slugs });

    expect(trios.trios.map((trio) => trio.variant.label)).toEqual(['Adam Warlock triple']);
    expect(unnamedGameIds).toEqual([LOKI]);
  });

  it('names the heroes of a trio by their ids in heroes.json, in the order of the game ids', () => {
    const { trios } = derive([row([ADAM, LUNA, LOKI], 12)]);

    expect(trios.trios[0].heroIds).toEqual([LOKI, LUNA, ADAM].sort((a, b) => a - b) as [number, number, number]);
    expect(trios.trios[0].heroes).toEqual(['loki', 'luna-snow', 'adam-warlock']);
  });

  it('lists the half-seasons and the modes, counted in the half-season shown', () => {
    const { trios } = derive([row([MANTIS, LUNA, LOKI], 20)]);

    expect(trios.halfSeasons?.map(({ id }) => id)).toEqual([10, 10.5]);
    expect(trios.mode).toBe('all');
    expect(trios.modes?.map(({ id, decidedMatches }) => [id, decidedMatches])).toEqual([
      ['all', 100],
      ['quick-match', 40],
      ['competitive', 60],
      ['arcade', 0],
      ['practice', 0],
    ]);
  });

  it('names the mode asked for, and a mode that names none is null', () => {
    expect(derive([], NAMES, { mode: 'competitive' }).trios.mode).toBe('competitive');
    expect(derive([], NAMES, { mode: 'ranked' }).trios.mode).toBeNull();
  });

  it('shows exactly the half-season asked for, even an empty one, instead of falling back', () => {
    const rows = [row([MANTIS, LUNA, LOKI], 20, { halfSeason: 10 }), row([ADAM, LUNA, LOKI], 4)];

    expect(derive(rows, NAMES, { halfSeason: 10 }).trios.trios.length).toBe(1);

    const current = derive(rows, NAMES, { halfSeason: 10.5 }).trios;

    expect([current.halfSeason?.id, current.inPlaceOf, current.status]).toEqual([10.5, null, 'not-enough-data']);
    expect(derive(rows, NAMES, { halfSeason: 11 }).trios.halfSeason).toBeNull();
  });

  it('reports 0 team counts while every trio is left out, as the contract says', () => {
    const { trios } = derive([row([MANTIS, LUNA, 1999], 40)]);

    expect(trios.status).toBe('not-enough-data');
    expect([trios.classifiedTeams, trios.unclassifiedTeams, trios.fourPlusTeams]).toEqual([0, 0, 0]);
  });

  it('builds the figures from the rows with no rank alone', () => {
    const { trios } = derive([
      row([MANTIS, LUNA, LOKI], 20),
      row([ADAM, LUNA, LOKI], 50, { rankBucket: 3, classifiedTeams: 999 }),
    ]);

    expect(trios.trios.length).toBe(1);
    expect(trios.classifiedTeams).toBe(200);
  });

  it('shows the previous half-season, naming the current one, while the current one has no trio at the minimum', () => {
    const { trios } = derive([row([MANTIS, LUNA, LOKI], 20, { halfSeason: 10 }), row([ADAM, LUNA, LOKI], 4)]);

    expect(trios.halfSeason?.id).toBe(10);
    expect(trios.inPlaceOf?.id).toBe(10.5);
    expect(trios.trios.length).toBe(1);
  });

  it('shows the current half-season once it has a trio at the minimum', () => {
    const { trios } = derive([row([MANTIS, LUNA, LOKI], 20, { halfSeason: 10 }), row([ADAM, LUNA, LOKI], 11)]);

    expect(trios.halfSeason?.id).toBe(10.5);
    expect(trios.inPlaceOf).toBeNull();
    expect(trios.trios[0].variant.label).toBe('Adam Warlock triple');
  });

  it('gives a share of 0, not a division by zero, when no team is classified', () => {
    const { trios } = derive([row([MANTIS, LUNA, LOKI], 20, { classifiedTeams: 0 })]);

    expect(trios.trios[0].share).toBe(0);
  });

  it('answers the empty state before any half-season exists', () => {
    const { trios } = deriveTripleSupportTrios([], { halfSeasons: [], totals: [] }, {
      now: NOW,
      tagByGameId: TAGS,
      nameByGameId: NAMES,
      slugByGameId: SLUGS,
    });

    expect(trios.halfSeason).toBeNull();
    expect(trios.status).toBe('not-enough-data');
  });
});
