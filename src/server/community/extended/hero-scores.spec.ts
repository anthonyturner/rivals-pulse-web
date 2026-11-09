import type { HeroScores } from '../../../contracts/hero-scores.model';
import { PLAY_MODE_IDS } from '../../heroes/stats/hero-stats';
import { assembleHeroScores, buildPulseAtlas, verifyPulseAtlas, type PulseAtlasFile } from '../../pulse-atlas/pulse-atlas';
import { bundledHeroAbilityTagTable, heroAbilitySlots, type HeroAbilitySlot } from './hero-ability-tags';
import {
  HERO_SCORE_MINIMUMS,
  deriveHeroScores,
  rankPositions,
  scoresOf,
  type FigureCount,
  type HeroScoreAbilityRow,
  type HeroScoreFigureRow,
  type HeroScoresSource,
} from './hero-scores';

const NOW = new Date('2026-10-30T12:00:00Z');
const HALF_SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];
const SLUGS = ['a', 'b', 'c', 'd', 'e', 'f'];
const HERO_SLUG_BY_GAME_ID = new Map(SLUGS.map((slug, index) => [index + 1, slug]));
const WAITING = { lines: 7, contributors: 2, busiestAboveHalf: false, qualifies: false, sum: 0, seconds: 0 };
const NO_LINES = { lines: 0, contributors: 0, busiestAboveHalf: false, qualifies: false, sum: 0, seconds: 0 };

function passing(sum: number, seconds = 600, lines = 20): FigureCount {
  return { lines, contributors: 4, busiestAboveHalf: false, qualifies: true, sum, seconds };
}

function figures(gameHeroId: number, parts: Partial<HeroScoreFigureRow> = {}): HeroScoreFigureRow {
  return {
    halfSeason: 10.5,
    playModeId: PLAY_MODE_IDS.competitive,
    gameHeroId,
    damage: passing(gameHeroId * 6000),
    healing: NO_LINES,
    blocked: NO_LINES,
    ...parts,
  };
}

function ability(gameHeroId: number, slot: string, parts: Partial<HeroScoreAbilityRow> = {}): HeroScoreAbilityRow {
  return {
    halfSeason: 10.5,
    playModeId: PLAY_MODE_IDS.competitive,
    gameHeroId,
    slot,
    lines: 20,
    contributors: 4,
    busiestAboveHalf: false,
    qualifies: true,
    usesSum: 40,
    usesTimedSum: 40,
    seconds: 1200,
    killsAfterSum: 10,
    killsAfterN: 20,
    assistsAfterSum: 10,
    assistsAfterN: 20,
    ...parts,
  };
}

const UTILITY_SLOT: HeroAbilitySlot = { slot: 'ability_0', ability: 'Stun', alsoIncludes: [], tag: 'Utility', cooldownSeconds: 10 };

function derive(
  source: Partial<HeroScoresSource>,
  slots: readonly HeroAbilitySlot[] = [UTILITY_SLOT],
  extra: { halfSeason?: number } = {},
) {
  return deriveHeroScores(
    { halfSeasons: HALF_SEASONS, figures: [], abilities: [], ...source },
    {
      now: NOW,
      heroSlugByGameId: HERO_SLUG_BY_GAME_ID,
      slotsByHero: new Map(SLUGS.map((slug) => [slug, slots])),
      ...extra,
    },
  );
}

function heroOf(heroes: readonly HeroScores[], slug: string): HeroScores {
  const found = heroes.find((hero) => hero.hero === slug);

  if (!found) {
    throw new Error(`no ${slug}`);
  }

  return found;
}

const FIVE_HEROES = [1, 2, 3, 4, 5];

describe('rankPositions', () => {
  it('runs from 0 for the lowest to 1 for the highest', () => {
    expect(rankPositions([30, 10, 20])).toEqual([1, 0, 0.5]);
  });

  it('gives equal values their shared middle place', () => {
    expect(rankPositions([10, 10, 20, 30])).toEqual([1 / 6, 1 / 6, 2 / 3, 1]);
  });

  it('has nothing to compare a lone value with', () => {
    expect(rankPositions([7])).toEqual([0.5]);
  });
});

describe('scoresOf', () => {
  const ranked = (...values: number[]) => ({ matches: 20, measures: {}, ranked: values.map((value) => ({ value, weight: 1 / values.length })) });

  it('spreads a ranking over the whole 1 to 10 scale', () => {
    expect(scoresOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => ranked(value)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('gives every hero the same score when all are tied', () => {
    expect(scoresOf([5, 5, 5, 5, 5].map((value) => ranked(value)))).toEqual([6, 6, 6, 6, 6]);
  });

  it('ranks two measures apart, so a large number in one cannot outweigh its rank', () => {
    const scores = scoresOf([ranked(1000000, 1), ranked(2, 2), ranked(3, 3), ranked(4, 4), ranked(5, 5)]);

    expect(scores[0]).toBeLessThan(scores[4]);
  });
});

describe('deriveHeroScores', () => {
  it('ranks damage per minute across the heroes that qualify', () => {
    const { scores } = derive({ figures: FIVE_HEROES.map((id) => figures(id)) });

    expect(scores.status).toBe('ready');
    expect(scores.heroes.map((hero) => hero.damage.score)).toEqual([1, 3, 6, 8, 10]);
    expect(heroOf(scores.heroes, 'e').damage).toEqual({
      status: 'scored',
      score: 10,
      label: 'measured',
      matches: 20,
      contributors: null,
      oneContributorAboveHalf: null,
      measures: { damagePerMinute: 3000 },
    });
  });

  it('gives no score to a hero below the rule, says how far along it is, and leaves it out of the ranking', () => {
    const { scores } = derive({
      figures: [...FIVE_HEROES.map((id) => figures(id)), figures(6, { damage: { ...WAITING, sum: 0 } })],
    });

    expect(heroOf(scores.heroes, 'f').damage).toEqual({
      status: 'collecting',
      score: null,
      label: 'measured',
      matches: 5,
      contributors: 2,
      oneContributorAboveHalf: false,
      measures: null,
    });
    expect(heroOf(scores.heroes, 'e').damage.score).toBe(10);
    expect(heroOf(scores.heroes, 'a').damage.score).toBe(1);
  });

  it('shows progress below the rule only in steps of 5, so one player\'s exact count is never published', () => {
    const lines = (count: number) => ({ ...WAITING, lines: count, contributors: 1, busiestAboveHalf: true });
    const matchesFor = (count: number) => heroOf(derive({ figures: [figures(1, { damage: lines(count) })] }).scores.heroes, 'a').damage.matches;

    expect([1, 4, 5, 9, 10, 14].map(matchesFor)).toEqual([0, 0, 5, 5, 10, 10]);
  });

  it('says when one player holding too many lines is what holds a hero back', () => {
    const held = { lines: 30, contributors: 3, busiestAboveHalf: true, qualifies: false, sum: 0, seconds: 0 };
    const { scores } = derive({ figures: [figures(1, { damage: held })] });

    expect(heroOf(scores.heroes, 'a').damage).toEqual(
      jasmine.objectContaining({ status: 'collecting', score: null, matches: 30, contributors: 3, oneContributorAboveHalf: true }),
    );
  });

  it('never adds lines across modes when saying how far along a hero is, because the rule is per mode', () => {
    const { scores } = derive({
      figures: [
        figures(1, { damage: { ...WAITING, lines: 4 } }),
        figures(1, { playModeId: PLAY_MODE_IDS.quickMatch, damage: { ...WAITING, lines: 7 } }),
      ],
    });

    expect(heroOf(scores.heroes, 'a').damage.matches).toBe(5);
  });

  it('pools only the modes that pass, and never Arcade or Practice', () => {
    const { scores } = derive({
      figures: [
        figures(1, { damage: passing(6000, 600) }),
        figures(1, { playModeId: PLAY_MODE_IDS.quickMatch, damage: WAITING }),
        figures(1, { playModeId: PLAY_MODE_IDS.arcade, damage: passing(999999, 600) }),
      ],
    });

    expect(heroOf(scores.heroes, 'a').damage.measures).toEqual({ damagePerMinute: 600 });
    expect(heroOf(scores.heroes, 'a').damage.matches).toBe(20);
  });

  it('holds back every score while too few heroes qualify, but keeps the figures that passed', () => {
    const { scores } = derive({ figures: [1, 2].map((id) => figures(id)) });

    expect(HERO_SCORE_MINIMUMS.rankedHeroes).toBe(3);
    expect(scores.status).toBe('not-enough-data');
    expect(heroOf(scores.heroes, 'b').damage).toEqual(
      jasmine.objectContaining({ status: 'ranking-too-small', score: null, measures: { damagePerMinute: 1200 } }),
    );
  });

  it('ranks a stat once exactly three heroes qualify', () => {
    const { scores } = derive({ figures: [1, 2, 3].map((id) => figures(id)) });

    expect(scores.status).toBe('ready');
    expect(scores.heroes.map((hero) => hero.damage.status)).toEqual(['scored', 'scored', 'scored']);
    expect(scores.heroes.map((hero) => hero.damage.score)).toEqual([1, 6, 10]);
  });

  it('gives a hero with partial data the scores it has and none of the others', () => {
    const { scores } = derive({
      figures: FIVE_HEROES.map((id) => figures(id)),
      abilities: [ability(1, 'ultimate', { lines: 3, contributors: 1, busiestAboveHalf: true, qualifies: false, usesSum: 0, usesTimedSum: 0, seconds: 0 })],
    });
    const hero = heroOf(scores.heroes, 'a');

    expect(hero.damage.status).toBe('scored');
    expect(hero.sustain).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 0, contributors: 0 }));
    expect(hero.ultimate).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 0, contributors: 1, oneContributorAboveHalf: true }));
    expect(hero.utility).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 0 }));
  });

  describe('sustain', () => {
    it('adds healing and damage blocked per minute', () => {
      const { scores } = derive({
        figures: FIVE_HEROES.map((id) => figures(id, { healing: passing(id * 1000), blocked: passing(600) })),
      });

      expect(heroOf(scores.heroes, 'a').sustain.measures).toEqual({ healingPerMinute: 100, blockedPerMinute: 60, sustainPerMinute: 160 });
      expect(scores.heroes.map((hero) => hero.sustain.score)).toEqual([1, 3, 6, 8, 10]);
    });

    it('leaves out a figure the feed never sent, rather than counting it as 0 or waiting for it', () => {
      const { scores } = derive({ figures: FIVE_HEROES.map((id) => figures(id, { healing: passing(id * 1000) })) });

      expect(heroOf(scores.heroes, 'a').sustain.measures).toEqual({ healingPerMinute: 100, sustainPerMinute: 100 });
    });

    it('waits while one of the two figures is held back, because the sum would understate the hero', () => {
      const { scores } = derive({ figures: FIVE_HEROES.map((id) => figures(id, { healing: passing(id * 1000), blocked: WAITING })) });

      expect(heroOf(scores.heroes, 'a').sustain).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 5, measures: null }));
    });
  });

  describe('ultimate', () => {
    it('is labelled estimated and reads uses per ten minutes and takedowns per use', () => {
      const { scores } = derive({ abilities: FIVE_HEROES.map((id) => ability(id, 'ultimate', { usesTimedSum: id * 10 })) });

      expect(heroOf(scores.heroes, 'a').ultimate).toEqual(
        jasmine.objectContaining({ status: 'scored', label: 'estimated', measures: { usesPerTenMinutes: 5, takedownsPerUse: 0.5 } }),
      );
      expect(heroOf(scores.heroes, 'e').ultimate.score).toBe(10);
    });

    it('counts a slot-wide kill count only over the lines that carry it', () => {
      const { scores } = derive({
        abilities: FIVE_HEROES.map((id) => ability(id, 'ultimate', { lines: 20, usesSum: 20, killsAfterSum: 5, killsAfterN: 10, assistsAfterSum: 0, assistsAfterN: 10 })),
      });

      expect(heroOf(scores.heroes, 'a').ultimate.measures?.['takedownsPerUse']).toBe(0.5);
    });

    it('has no score when the app counted no kills or assists, since 0 would be a guess', () => {
      const { scores } = derive({ abilities: FIVE_HEROES.map((id) => ability(id, 'ultimate', { killsAfterN: 0, assistsAfterN: 0 })) });

      expect(heroOf(scores.heroes, 'a').ultimate).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 20, contributors: 4, oneContributorAboveHalf: false }));
    });
  });

  describe('utility', () => {
    it('compares uses with how often the cooldown allowed them', () => {
      const { scores } = derive({ abilities: FIVE_HEROES.map((id) => ability(id, 'ability_0', { usesTimedSum: id * 10 })) });

      // 1200 seconds with a 10 second cooldown allows 120 uses.
      expect(heroOf(scores.heroes, 'c').utility).toEqual(
        jasmine.objectContaining({ status: 'scored', label: 'estimated', measures: { useOfAvailable: 0.25, takedownsPerUse: 0.5 } }),
      );
    });

    it('caps use of what is available at all of it, as a cooldown cut can pass the printed cooldown', () => {
      const { scores } = derive({ abilities: FIVE_HEROES.map((id) => ability(id, 'ability_0', { usesTimedSum: 500 })) });

      expect(heroOf(scores.heroes, 'a').utility.measures?.['useOfAvailable']).toBe(1);
    });

    it('ignores a slot the hero lacks, which the overlay sends at 0', () => {
      const withEmptySlots = (id: number) => [
        ability(id, 'ability_0', { usesTimedSum: id * 10 }),
        ...['ability_1', 'ability_4', 'team_up_1'].map((slot) => ability(id, slot, { usesSum: 0, usesTimedSum: 0, killsAfterSum: 0, assistsAfterSum: 0 })),
      ];
      const { scores } = derive({ abilities: FIVE_HEROES.flatMap(withEmptySlots) });
      const hero = heroOf(scores.heroes, 'c');

      expect(hero.utility.measures).toEqual({ useOfAvailable: 0.25, takedownsPerUse: 0.5 });
      expect(hero.abilities.map((row) => row.slot)).toEqual(['ability_0']);
    });

    it('does not let a damage ability, an untagged one or one with no plain cooldown raise it', () => {
      const slots: HeroAbilitySlot[] = [
        UTILITY_SLOT,
        { slot: 'ability_1', ability: 'Blast', alsoIncludes: [], tag: 'Damage', cooldownSeconds: 2 },
        { slot: 'ability_2', ability: 'Unknown', alsoIncludes: [], tag: null, cooldownSeconds: 2 },
        { slot: 'ability_3', ability: 'Charges', alsoIncludes: [], tag: 'Utility', cooldownSeconds: null },
      ];
      const { scores } = derive(
        {
          abilities: FIVE_HEROES.flatMap((id) => [
            ability(id, 'ability_0', { usesTimedSum: id * 10 }),
            ability(id, 'ability_1', { usesTimedSum: 500, killsAfterSum: 900 }),
            ability(id, 'ability_2', { usesTimedSum: 500, killsAfterSum: 900 }),
            ability(id, 'ability_3', { usesTimedSum: 500, killsAfterSum: 900 }),
          ]),
        },
        slots,
      );

      expect(heroOf(scores.heroes, 'c').utility.measures).toEqual({ useOfAvailable: 0.25, takedownsPerUse: 0.5 });
    });

    it('says a hero has nothing to measure rather than scoring it low', () => {
      const { scores } = derive({ abilities: [ability(1, 'ability_1')] }, [{ slot: 'ability_1', ability: 'Blast', alsoIncludes: [], tag: 'Damage', cooldownSeconds: 8 }]);

      expect(heroOf(scores.heroes, 'a').utility).toEqual(jasmine.objectContaining({ status: 'no-measurable-ability', score: null, matches: 0, contributors: null }));
    });
  });

  it('lists per-ability figures only for a slot that passes the rule on its own, and never tags the ultimate', () => {
    const slots: HeroAbilitySlot[] = [
      UTILITY_SLOT,
      { slot: 'ability_1', ability: 'Blast', alsoIncludes: [], tag: 'Damage', cooldownSeconds: 8 },
      { slot: 'ultimate', ability: 'Big One', alsoIncludes: ['Duo Strike'], tag: 'Damage', cooldownSeconds: null },
    ];
    const { scores } = derive(
      {
        abilities: [
          ability(1, 'ability_0'),
          ability(1, 'ability_1', { lines: 3, contributors: 1, qualifies: false, usesSum: 0, usesTimedSum: 0, seconds: 0 }),
          ability(1, 'ultimate'),
        ],
      },
      slots,
    );

    expect(heroOf(scores.heroes, 'a').abilities).toEqual([
      { slot: 'ability_0', ability: 'Stun', alsoIncludes: [], tag: 'Utility', usesPerTenMinutes: 20, takedownsPerUse: 0.5, matches: 20 },
      { slot: 'ultimate', ability: 'Big One', alsoIncludes: ['Duo Strike'], tag: null, usesPerTenMinutes: 20, takedownsPerUse: 0.5, matches: 20 },
    ]);
  });

  it('merges a hero the game splits by role, and reports a game id with no hero', () => {
    const { scores, excludedGameIds } = deriveHeroScores(
      { halfSeasons: HALF_SEASONS, figures: [figures(1), figures(11), figures(99)], abilities: [] },
      { now: NOW, heroSlugByGameId: new Map([[1, 'a'], [11, 'a']]), slotsByHero: new Map() },
    );

    expect(scores.heroes.map((hero) => hero.hero)).toEqual(['a']);
    expect(scores.heroes[0].damage.matches).toBe(40);
    expect(excludedGameIds).toEqual([99]);
  });

  it('is the empty state with no data, and lists every started half-season', () => {
    const { scores } = derive({});

    expect(scores.status).toBe('not-enough-data');
    expect(scores.heroes).toEqual([]);
    expect(scores.halfSeason?.id).toBe(10.5);
    expect(scores.inPlaceOf).toBeNull();
    expect(scores.halfSeasons.map((season) => season.id)).toEqual([10, 10.5]);
  });

  it('shows the previous half-season, naming the current one, until the current one has a score', () => {
    const { scores } = derive({ figures: FIVE_HEROES.map((id) => figures(id, { halfSeason: 10 })) });

    expect(scores.halfSeason?.id).toBe(10);
    expect(scores.inPlaceOf?.id).toBe(10.5);
    expect(scores.heroes.length).toBe(5);
  });

  it('keeps to an exact half-season when asked, with no fall-back', () => {
    const { scores } = derive({ figures: FIVE_HEROES.map((id) => figures(id, { halfSeason: 10 })) }, [UTILITY_SLOT], { halfSeason: 10.5 });

    expect(scores.halfSeason?.id).toBe(10.5);
    expect(scores.inPlaceOf).toBeNull();
    expect(scores.heroes).toEqual([]);
  });
});

describe('the derived scores in Pulse Atlas', () => {
  const fakeSha256 = (text: string): string => String(text.length).padStart(64, '0');
  const gameIds = SLUGS.map((id, index) => ({ id, gameId: index + 1 }));

  function publish(scores: unknown): { files: PulseAtlasFile[]; warnings: string[] } {
    return publishData(assembleHeroScores(JSON.parse(JSON.stringify(scores)), gameIds));
  }

  function publishData(data: unknown): { files: PulseAtlasFile[]; warnings: string[] } {
    const warnings: string[] = [];
    const season = { id: 21, label: 'Season 10.5', startTime: '2026-10-09T09:00:00Z' };
    const files = buildPulseAtlas(
      [
        { dataset: 'heroes', source: 't', data: SLUGS.map((id) => ({ id, name: id })) },
        {
          dataset: 'tier-list',
          source: 't',
          data: {
            provenance: 'rivals-pulse-community',
            currentSeasonId: 21,
            rankFilters: [{ value: '99', label: 'All Ranks' }],
            seasons: [{ ...season, ranks: { '99': { tiers: [] } } }],
          },
        },
        { dataset: 'glossary', source: 't', data: [{ id: 'dive', term: 'Dive' }] },
        { dataset: 'maps', source: 't', data: [{ id: 1, name: 'Map' }] },
        { dataset: 'hero-styles', source: 't', data: SLUGS.map((heroId) => ({ heroId, poke: 100, dive: 0, brawl: 0 })) },
        {
          dataset: 'hero-stats',
          source: 't',
          data: { provenance: 'rivals-pulse-community', minimumMatches: 10, currentSeasonId: 21, seasons: [{ ...season, decidedMatches: 0, heroes: [] }] },
        },
        { dataset: 'hero-scores', source: 't', data },
        { dataset: 'hero-game-ids', source: 't', data: gameIds },
        { dataset: 'strategist-tags', source: 't', data: [{ heroId: 'unlisted-healer', tag: 'healer' }] },
      ],
      '2026-11-05T00:00:00.000Z',
      fakeSha256,
      [],
      (warning) => warnings.push(warning),
    );

    verifyPulseAtlas(files, fakeSha256);

    return { files, warnings };
  }

  it('passes the allow-list in every status a hero can be in, with nothing but numbers about people', () => {
    const { scores } = derive({
      figures: [...FIVE_HEROES.map((id) => figures(id, { healing: passing(id * 1000), blocked: passing(600) })), figures(6, { damage: WAITING })],
      abilities: [
        ...FIVE_HEROES.flatMap((id) => [ability(id, 'ability_0'), ability(id, 'ultimate')]),
        ability(6, 'ultimate', { lines: 3, contributors: 1, busiestAboveHalf: true, qualifies: false, usesSum: 0, usesTimedSum: 0, seconds: 0 }),
      ],
    });
    const { files, warnings } = publish(scores);
    const published = JSON.parse(files.find((file) => file.path.endsWith('hero-scores.json'))?.content ?? 'null');

    expect(warnings.filter((warning) => warning.includes('hero-scores'))).toEqual([]);
    expect(published.data.heroes.map((hero: { heroId: number }) => hero.heroId)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(published.data.heroes[4].damage.score).toBe(10);
    expect(published.data.heroes[5].damage.status).toBe('collecting');
    expect(published.data.heroes[5].damage.measures).toBeNull();
  });

  it('passes the allow-list with the real tag table for every hero', () => {
    const heroes = bundledHeroAbilityTagTable.heroes.map((hero) => hero.heroId);
    const slugs = new Map(heroes.map((hero, index) => [index + 1, hero]));
    const slots = ['ability_0', 'ability_1', 'ability_2', 'ability_3', 'team_up_0', 'ultimate'];
    const { scores } = deriveHeroScores(
      {
        halfSeasons: HALF_SEASONS,
        figures: heroes.map((_, index) => figures(index + 1)),
        abilities: heroes.flatMap((_, index) => slots.map((slot) => ability(index + 1, slot, { usesTimedSum: index }))),
      },
      { now: NOW, heroSlugByGameId: slugs, slotsByHero: heroAbilitySlots() },
    );
    const data = assembleHeroScores(JSON.parse(JSON.stringify(scores)), heroes.map((id, index) => ({ id, gameId: index + 1 })));

    expect(scores.heroes.length).toBe(heroes.length);
    expect(() => publishData(data)).not.toThrow();
  });

  it('publishes how many heroes qualify for each stat, whether or not that is enough to rank', () => {
    const { scores } = derive({
      figures: [...[1, 2, 3].map((id) => figures(id, { healing: id < 3 ? passing(id * 1000) : NO_LINES })), figures(4, { damage: WAITING })],
    });
    const { files } = publish(scores);
    const published = JSON.parse(files.find((file) => file.path.endsWith('hero-scores.json'))?.content ?? 'null');

    expect(published.data.qualifiedHeroes).toEqual({ damage: 3, sustain: 2, ultimate: 0, utility: 0 });
    expect(published.data.minimums.rankedHeroes).toBe(3);
    expect(published.data.heroes[0].damage.status).toBe('scored');
    expect(published.data.heroes[0].sustain.status).toBe('ranking-too-small');
  });

  it('passes the allow-list with too few heroes to rank, and with nothing at all', () => {
    expect(() => publish(derive({ figures: [figures(1)] }, []).scores)).not.toThrow();
    expect(() => publish(derive({}).scores)).not.toThrow();
  });
});
