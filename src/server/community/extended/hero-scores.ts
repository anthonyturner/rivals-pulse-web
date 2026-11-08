import type {
  CommunityHeroScores,
  HeroScoreAbility,
  HeroScoreLabel,
  HeroScoreMinimums,
  HeroScores,
  HeroScoreStat,
} from '../../../contracts/hero-scores.model.ts';
import { BLENDED_PLAY_MODE_IDS, chooseHalfSeason, halfSeasonTimeline, type HalfSeasonStart } from '../../heroes/stats/hero-stats.ts';
import { heroAbilitySlots, type HeroAbilitySlot } from './hero-ability-tags.ts';

/**
 * Turns the counts from `read_community_hero_scores()` into the 1 to 10 scores. The reasoning behind
 * the rule, the weights and the ranking is in docs/hero-build-scores.md.
 */

export const HERO_SCORE_MINIMUMS: HeroScoreMinimums = {
  // The first three mirror `read_community_hero_scores`, which is where the rule is applied. They are here
  // so the output can say how far along a hero is.
  matches: 10,
  contributors: 1,
  busiestContributorShare: 1,
  // A ranking of two heroes would call one of them 10 and the other 1; three is the smallest that has a
  // middle. A temporary floor while contributors are few: with 5, only three heroes qualified and every
  // stat waited. Raise it again once more heroes pass the rule.
  rankedHeroes: 3,
};

/** How much each ranked measure counts toward a score made of two. Change a stat's weights here. */
export const HERO_SCORE_WEIGHTS = {
  ultimate: { usesPerTenMinutes: 0.5, takedownsPerUse: 0.5 },
  utility: { useOfAvailable: 0.5, takedownsPerUse: 0.5 },
} as const;

/** Whether a count of lines passes the rule, and how far along it is. Sums beside it are 0 unless it passes. */
export interface GatedCount {
  lines: number;
  contributors: number;
  busiestAboveHalf: boolean;
  qualifies: boolean;
}

export interface FigureCount extends GatedCount {
  sum: number;
  seconds: number;
}

/** One hero in one half-season and mode. */
export interface HeroScoreFigureRow {
  halfSeason: number;
  playModeId: number;
  gameHeroId: number;
  damage: FigureCount;
  healing: FigureCount;
  blocked: FigureCount;
}

/** One hero's slot in one half-season and mode. */
export interface HeroScoreAbilityRow extends GatedCount {
  halfSeason: number;
  playModeId: number;
  gameHeroId: number;
  slot: string;
  usesSum: number;
  /** The uses on lines with a time played, over the same lines as `seconds`. */
  usesTimedSum: number;
  seconds: number;
  killsAfterSum: number;
  killsAfterN: number;
  assistsAfterSum: number;
  assistsAfterN: number;
}

export interface HeroScoresSource {
  halfSeasons: readonly HalfSeasonStart[];
  figures: readonly HeroScoreFigureRow[];
  abilities: readonly HeroScoreAbilityRow[];
}

export interface DeriveHeroScoresOptions {
  now: Date;
  /** Exactly this half-season, with no fall-back to the previous one. */
  halfSeason?: number;
  /** Game hero id to the hero's id in `heroes.json`. A game id missing here is left out. */
  heroSlugByGameId: ReadonlyMap<number, string>;
  /** Defaults to the table in `hero-ability-tags.table.json`. */
  slotsByHero?: ReadonlyMap<string, readonly HeroAbilitySlot[]>;
}

export interface HeroScoresDerivation {
  scores: CommunityHeroScores;
  /** Game hero ids in the counted rows that map to no hero. */
  excludedGameIds: number[];
}

const ULTIMATE_SLOT = 'ultimate';
const SECONDS_PER_TEN_MINUTES = 600;
// With few players, an exact count below the rule is one person's own games on a hero, and comparing
// two publishes would show when they played. In steps it still says how far along a hero is.
const PROGRESS_MATCH_STEP = 5;

/** The lines of one input: those that pass the rule, and those that do not yet. */
interface Gate<T extends GatedCount> {
  ready: T[];
  waiting: T[];
}

function gateOf<T extends GatedCount>(counts: readonly T[]): Gate<T> {
  const present = counts.filter((count) => count.lines > 0);

  return { ready: present.filter((count) => count.qualifies), waiting: present.filter((count) => !count.qualifies) };
}

const hasLines = (gate: Gate<GatedCount>): boolean => gate.ready.length + gate.waiting.length > 0;

const sumOf = <T>(rows: readonly T[], value: (row: T) => number): number => rows.reduce((total, row) => total + value(row), 0);

const rounded = (value: number): number => Math.round(value * 100) / 100;

const progressMatches = (lines: number): number => Math.floor(lines / PROGRESS_MATCH_STEP) * PROGRESS_MATCH_STEP;

/**
 * A stat before ranking. `measures` is what is published; `ranked` is what the ranking reads, the
 * measures and weights of a score made of two, or the one measure of a score made of one.
 */
interface ReadyStat {
  matches: number;
  measures: Record<string, number>;
  ranked: { value: number; weight: number }[];
}

type Measure = ReadyStat | null;

function collecting(label: HeroScoreLabel, gates: readonly Gate<GatedCount>[]): HeroScoreStat {
  // The input furthest behind is what holds the stat back. A row's mode is applied on its own, so
  // lines in two modes are not added: the closest single mode is how far along it really is. When
  // every input passes and only a usable figure is missing, the passing lines are how far along it is.
  const held = gates.filter((gate) => gate.ready.length === 0 && gate.waiting.length > 0);
  const rowsOf = (gate: Gate<GatedCount>): GatedCount[] => (held.length > 0 ? gate.waiting : gate.ready);
  const closest = (held.length > 0 ? held : gates)
    .flatMap((gate) => (rowsOf(gate).length === 0 ? [] : [rowsOf(gate).reduce((best, row) => (row.lines > best.lines ? row : best))]))
    .sort((a, b) => a.lines - b.lines)[0];

  return {
    status: 'collecting',
    score: null,
    label,
    matches: progressMatches(closest?.lines ?? 0),
    contributors: closest?.contributors ?? 0,
    oneContributorAboveHalf: closest?.busiestAboveHalf ?? false,
    measures: null,
  };
}

/**
 * The rule for every stat: each input it uses must pass, and an input with no lines at all (a figure
 * the feed never sent for this hero) is left out rather than counted as 0 or as waiting.
 */
function stat(label: HeroScoreLabel, gates: readonly Gate<GatedCount>[], measure: () => Measure): ReadyStat | HeroScoreStat {
  const present = gates.filter(hasLines);

  if (present.length === 0 || present.some((gate) => gate.ready.length === 0)) {
    return collecting(label, gates);
  }

  return measure() ?? collecting(label, present);
}

function perMinuteOf(gate: Gate<FigureCount>): number | null {
  const seconds = sumOf(gate.ready, (row) => row.seconds);

  return seconds > 0 ? (sumOf(gate.ready, (row) => row.sum) * 60) / seconds : null;
}

function damageStat(rows: readonly HeroScoreFigureRow[]): ReadyStat | HeroScoreStat {
  const gate = gateOf(rows.map((row) => row.damage));

  return stat('measured', [gate], () => {
    const rate = perMinuteOf(gate);

    return rate === null
      ? null
      : {
          matches: sumOf(gate.ready, (row) => row.lines),
          measures: { damagePerMinute: Math.round(rate) },
          ranked: [{ value: rate, weight: 1 }],
        };
  });
}

function sustainStat(rows: readonly HeroScoreFigureRow[]): ReadyStat | HeroScoreStat {
  const healing = gateOf(rows.map((row) => row.healing));
  const blocked = gateOf(rows.map((row) => row.blocked));
  const gates = [healing, blocked];

  return stat('measured', gates, () => {
    const healingRate = perMinuteOf(healing);
    const blockedRate = perMinuteOf(blocked);

    if (healingRate === null && blockedRate === null) {
      return null;
    }

    const total = (healingRate ?? 0) + (blockedRate ?? 0);

    return {
      matches: Math.min(...gates.filter(hasLines).map((gate) => sumOf(gate.ready, (row) => row.lines))),
      measures: {
        ...(healingRate === null ? {} : { healingPerMinute: Math.round(healingRate) }),
        ...(blockedRate === null ? {} : { blockedPerMinute: Math.round(blockedRate) }),
        sustainPerMinute: Math.round(total),
      },
      ranked: [{ value: total, weight: 1 }],
    };
  });
}

/**
 * Kills and assists soon after a use, per use. Older lines may not carry them, so each is taken per
 * line that carries it and set against uses per line. Null when no line carries one of them.
 */
function takedownsPerUse(rows: readonly HeroScoreAbilityRow[]): number | null {
  const killsN = sumOf(rows, (row) => row.killsAfterN);
  const assistsN = sumOf(rows, (row) => row.assistsAfterN);

  if (killsN === 0 || assistsN === 0) {
    return null;
  }

  const usesPerLine = sumOf(rows, (row) => row.usesSum) / sumOf(rows, (row) => row.lines);

  return usesPerLine === 0
    ? 0
    : (sumOf(rows, (row) => row.killsAfterSum) / killsN + sumOf(rows, (row) => row.assistsAfterSum) / assistsN) / usesPerLine;
}

function usesPerTenMinutes(rows: readonly HeroScoreAbilityRow[]): number | null {
  const seconds = sumOf(rows, (row) => row.seconds);

  return seconds > 0 ? (sumOf(rows, (row) => row.usesTimedSum) * SECONDS_PER_TEN_MINUTES) / seconds : null;
}

function ultimateStat(rows: readonly HeroScoreAbilityRow[]): ReadyStat | HeroScoreStat {
  const gate = gateOf(rows.filter((row) => row.slot === ULTIMATE_SLOT));

  return stat('estimated', [gate], () => {
    const uses = usesPerTenMinutes(gate.ready);
    const takedowns = takedownsPerUse(gate.ready);

    return uses === null || takedowns === null
      ? null
      : {
          matches: sumOf(gate.ready, (row) => row.lines),
          measures: { usesPerTenMinutes: rounded(uses), takedownsPerUse: rounded(takedowns) },
          ranked: [
            { value: uses, weight: HERO_SCORE_WEIGHTS.ultimate.usesPerTenMinutes },
            { value: takedowns, weight: HERO_SCORE_WEIGHTS.ultimate.takedownsPerUse },
          ],
        };
  });
}

function utilityStat(rows: readonly HeroScoreAbilityRow[], slots: readonly HeroAbilitySlot[]): ReadyStat | HeroScoreStat {
  const measurable = slots.filter((slot) => slot.tag === 'Utility' && slot.slot !== ULTIMATE_SLOT && slot.cooldownSeconds !== null);

  if (measurable.length === 0) {
    return {
      status: 'no-measurable-ability',
      score: null,
      label: 'estimated',
      matches: 0,
      contributors: null,
      oneContributorAboveHalf: null,
      measures: null,
    };
  }

  const gates = measurable.map((slot) => ({ slot, gate: gateOf(rows.filter((row) => row.slot === slot.slot)) }));

  return stat('estimated', gates.map(({ gate }) => gate), () => {
    const ready = gates.flatMap(({ slot, gate }) => gate.ready.map((row) => ({ row, cooldownSeconds: slot.cooldownSeconds ?? 0 })));
    const uses = sumOf(ready, ({ row }) => row.usesTimedSum);
    const available = sumOf(ready, ({ row, cooldownSeconds }) => row.seconds / cooldownSeconds);
    const takedowns = takedownsPerUse(ready.map(({ row }) => row));

    if (available === 0 || takedowns === null) {
      return null;
    }

    // A cooldown cut can let a hero use an ability more often than its printed cooldown allows.
    const useOfAvailable = Math.min(1, uses / available);

    return {
      matches: Math.min(...gates.filter(({ gate }) => hasLines(gate)).map(({ gate }) => sumOf(gate.ready, (row) => row.lines))),
      measures: { useOfAvailable: rounded(useOfAvailable), takedownsPerUse: rounded(takedowns) },
      ranked: [
        { value: useOfAvailable, weight: HERO_SCORE_WEIGHTS.utility.useOfAvailable },
        { value: takedowns, weight: HERO_SCORE_WEIGHTS.utility.takedownsPerUse },
      ],
    };
  });
}

function abilitiesOf(rows: readonly HeroScoreAbilityRow[], slots: readonly HeroAbilitySlot[]): HeroScoreAbility[] {
  return slots.flatMap((slot) => {
    const { ready } = gateOf(rows.filter((row) => row.slot === slot.slot));
    const uses = ready.length === 0 ? null : usesPerTenMinutes(ready);

    if (uses === null) {
      return [];
    }

    const takedowns = takedownsPerUse(ready);

    return [
      {
        slot: slot.slot,
        ability: slot.ability,
        tag: slot.slot === ULTIMATE_SLOT ? null : slot.tag,
        usesPerTenMinutes: rounded(uses),
        takedownsPerUse: takedowns === null ? null : rounded(takedowns),
        matches: sumOf(ready, (row) => row.lines),
      },
    ];
  });
}

/**
 * Where each value sits among the others, from 0 (lowest) to 1 (highest). Equal values share their
 * middle place, so a tie never decides who is ahead.
 */
export function rankPositions(values: readonly number[]): number[] {
  if (values.length < 2) {
    return values.map(() => 0.5);
  }

  return values.map((value) => {
    const below = values.filter((other) => other < value).length;
    const equal = values.filter((other) => other === value).length;

    return (below + (equal - 1) / 2) / (values.length - 1);
  });
}

/** The 1 to 10 score of each hero, by rank. Two ranked measures are ranked apart, weighted, then ranked again. */
export function scoresOf(stats: readonly ReadyStat[]): number[] {
  const measureCount = stats[0]?.ranked.length ?? 0;
  const positions = Array.from({ length: measureCount }, (_, measure) => rankPositions(stats.map((one) => one.ranked[measure].value)));
  const combined = stats.map((one, hero) => one.ranked.reduce((total, measure, index) => total + positions[index][hero] * measure.weight, 0));

  return rankPositions(combined).map((position) => 1 + Math.round(position * 9));
}

const isReady = (value: ReadyStat | HeroScoreStat): value is ReadyStat => 'ranked' in value;

/** Ranks one stat across heroes. A hero that is not ready keeps its cell; the rest get a score or wait for more heroes. */
function rankStat(label: HeroScoreLabel, values: readonly (ReadyStat | HeroScoreStat)[]): HeroScoreStat[] {
  const ready = values.filter(isReady);
  const enough = ready.length >= HERO_SCORE_MINIMUMS.rankedHeroes;
  const scores = enough ? scoresOf(ready) : [];

  return values.map((value) => {
    if (!isReady(value)) {
      return value;
    }

    return {
      status: enough ? 'scored' : 'ranking-too-small',
      score: enough ? scores[ready.indexOf(value)] : null,
      label,
      matches: value.matches,
      contributors: null,
      oneContributorAboveHalf: null,
      measures: value.measures,
    };
  });
}

function heroScoresOf(
  figures: readonly HeroScoreFigureRow[],
  abilities: readonly HeroScoreAbilityRow[],
  options: DeriveHeroScoresOptions,
  slotsByHero: ReadonlyMap<string, readonly HeroAbilitySlot[]>,
): HeroScores[] {
  const slugOf = (row: { gameHeroId: number }): string | undefined => options.heroSlugByGameId.get(row.gameHeroId);
  const heroes = [
    ...new Set([...figures, ...abilities].flatMap((row) => slugOf(row) ?? [])),
  ].sort((a, b) => a.localeCompare(b));
  const figuresOf = (hero: string) => figures.filter((row) => slugOf(row) === hero);
  const abilitiesFor = (hero: string) => abilities.filter((row) => slugOf(row) === hero);
  const slotsOf = (hero: string) => slotsByHero.get(hero) ?? [];
  const damage = rankStat('measured', heroes.map((hero) => damageStat(figuresOf(hero))));
  const sustain = rankStat('measured', heroes.map((hero) => sustainStat(figuresOf(hero))));
  const ultimate = rankStat('estimated', heroes.map((hero) => ultimateStat(abilitiesFor(hero))));
  const utility = rankStat('estimated', heroes.map((hero) => utilityStat(abilitiesFor(hero), slotsOf(hero))));

  return heroes.map((hero, index) => ({
    hero,
    damage: damage[index],
    sustain: sustain[index],
    ultimate: ultimate[index],
    utility: utility[index],
    abilities: abilitiesOf(abilitiesFor(hero), slotsOf(hero)),
  }));
}

export function deriveHeroScores(source: HeroScoresSource, options: DeriveHeroScoresOptions): HeroScoresDerivation {
  const slotsByHero = options.slotsByHero ?? heroAbilitySlots();
  const inBlend = <T extends { playModeId: number }>(rows: readonly T[]): T[] =>
    rows.filter((row) => BLENDED_PLAY_MODE_IDS.includes(row.playModeId));
  const figures = inBlend(source.figures);
  const abilities = inBlend(source.abilities);
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    [...figures, ...abilities].map((row) => row.halfSeason),
    options.now,
  );
  const cache = new Map<number, HeroScores[]>();
  const heroesIn = (halfSeason: number): HeroScores[] => {
    const heroes =
      cache.get(halfSeason) ??
      heroScoresOf(
        figures.filter((row) => row.halfSeason === halfSeason),
        abilities.filter((row) => row.halfSeason === halfSeason),
        options,
        slotsByHero,
      );
    cache.set(halfSeason, heroes);

    return heroes;
  };
  const hasScore = (hero: HeroScores): boolean =>
    [hero.damage, hero.sustain, hero.ultimate, hero.utility].some((cell) => cell.status === 'scored');
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => heroesIn(id).some(hasScore));
  const heroes = shown === undefined ? [] : heroesIn(shown);
  const excludedGameIds = [
    ...new Set(
      [...figures, ...abilities]
        .filter((row) => row.halfSeason === shown && !options.heroSlugByGameId.has(row.gameHeroId))
        .map((row) => row.gameHeroId),
    ),
  ].sort((a, b) => a - b);

  return {
    scores: {
      status: heroes.some(hasScore) ? 'ready' : 'not-enough-data',
      minimums: { ...HERO_SCORE_MINIMUMS },
      halfSeasons: timeline.started.map(timeline.describe),
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      heroes,
    },
    excludedGameIds,
  };
}
