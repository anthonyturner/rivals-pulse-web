import type {
  CommunityHeroScores,
  HeroScores,
  HeroScoreStat,
} from '../../../../contracts/hero-scores.model';
import { countLabel } from '../../../shared/utilities/stat-labels';
import { heroKitMobilityValue } from '../hero-kit-mobility';

export type HeroBuildType = 'Damage' | 'Sustain' | 'Ultimate' | 'Utility' | 'Mobility';

export type BuildSignalSource = 'Measured' | 'Estimated' | 'Hero kit';

/** `undefined` while loading, `null` when the scores could not be read. */
export type HeroScoresAnswer = CommunityHeroScores | null | undefined;

/** What a build signal row renders, for one hero or one team. */
export interface BuildSignalRow {
  type: HeroBuildType;
  source: BuildSignalSource;
  /** Out of 10, or null when there is no number to show. */
  value: number | null;
  /** How many heroes the number rests on: 1 for one hero with a number, 0 without one. */
  used: number;
  /** The number as printed, or the plain words for why there is none. */
  valueLabel: string;
  /** What the number rests on, or how far along the hero is. */
  detail: string;
  /** The figures behind the score, once the hero has passed the rule. */
  figures: string | null;
  ariaLabel: string;
  collection?: { matches: number; minimum: number };
}

export interface HeroSignalTile {
  type: HeroBuildType;
  shortLabel: string;
  source: BuildSignalSource;
  valueLabel: string;
  ariaLabel: string;
}

/** One hero's card on the team builder. */
export type HeroSignalCard =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'scored'; tiles: HeroSignalTile[]; sample: string }
  | { kind: 'waiting'; heading: string; progress: string; percent: number };

export interface HeroAbilityUseRow {
  slot: string;
  keyLabel: string;
  ability: string;
  /** What kind of ability this is. It does not say which score the ability feeds. */
  type: string;
  uses: string;
  takedowns: string;
  matches: string;
}

type MatchSignal = Exclude<HeroBuildType, 'Mobility'>;

const SIGNAL_TYPES: readonly HeroBuildType[] = ['Damage', 'Sustain', 'Ultimate', 'Utility', 'Mobility'];

const SHORT_LABELS: Record<HeroBuildType, string> = {
  Damage: 'Dmg',
  Sustain: 'Sus',
  Ultimate: 'Ult',
  Utility: 'Utl',
  Mobility: 'Mob',
};

const STAT_KEYS: Record<MatchSignal, 'damage' | 'sustain' | 'ultimate' | 'utility'> = {
  Damage: 'damage',
  Sustain: 'sustain',
  Ultimate: 'ultimate',
  Utility: 'utility',
};

const WHAT_IS_COUNTED: Record<MatchSignal, string> = {
  Damage: 'Damage per minute, ranked against the other heroes with enough data.',
  Sustain: 'Healing plus damage blocked per minute, ranked against the other heroes with enough data.',
  Ultimate:
    'Ultimates used and the kills and assists right after. The game shows an ability was used, not whether it landed.',
  Utility:
    'How much of its cooldowns a hero used, and what followed. The game shows an ability was used, not whether it landed.',
};

const KEY_LABELS: Record<string, string> = {
  ability_0: 'Right Click',
  ability_1: 'Shift',
  ability_2: 'E',
  ability_3: 'F',
  team_up_0: 'C',
  ultimate: 'Q',
};

const NO_KIT_VALUE = 'No value yet';
const COLLECTING = 'Collecting data';
const NOT_MEASURABLE = 'Not measurable yet';
const WAITING_FOR_HEROES = 'Waiting for more heroes';
const LOADING = 'Loading';
const UNAVAILABLE = 'Not available';
const CANNOT_LOAD = 'Scores cannot be loaded right now.';

/** Mobility never needs match data, so it reads the same whatever the scores answered. */
export function heroBuildSignals(heroId: string, answer: HeroScoresAnswer): BuildSignalRow[] {
  return SIGNAL_TYPES.map((type) =>
    type === 'Mobility' ? mobilityRow(heroId) : matchSignalRow(type, heroId, answer),
  );
}

/** The sentence behind every number on the page: where it comes from and when a hero gets one. */
export function scoresSourceNote(answer: HeroScoresAnswer): string | null {
  if (!answer) {
    return null;
  }

  const { matches, contributors, busiestContributorShare } = answer.minimums;
  const from = answer.halfSeason ? `${answer.halfSeason.label} ` : '';

  if (contributors === 1 && busiestContributorShare === 1) {
    return `Built from ${from}Quick Match and Competitive matches recorded by RivalsPulse players. During solo testing, one player can supply all matches. Figures appear after at least ${matches} matches per hero and mode; scores need ${answer.minimums.rankedHeroes} qualifying heroes.`;
  }

  const share =
    busiestContributorShare < 1 ? `, with no single player making up more than ${shareLabel(busiestContributorShare)}` : '';

  return `Built from ${from}Quick Match and Competitive matches recorded by RivalsPulse players. A hero gets a score once it has at least ${matches} matches from at least ${contributors} players${share}.`;
}

/** The hero's team builder card: its scores once it has any, or how far along it is. */
export function heroSignalCard(heroId: string, answer: HeroScoresAnswer): HeroSignalCard {
  if (answer === undefined) {
    return { kind: 'loading' };
  }

  if (answer === null) {
    return { kind: 'unavailable' };
  }

  const stats = matchStatsOf(heroEntry(answer, heroId));
  const scored = stats.filter((stat) => stat.status === 'scored');

  if (scored.length > 0) {
    return {
      kind: 'scored',
      tiles: heroBuildSignals(heroId, answer).map(signalTile),
      sample: `From ${Math.max(...scored.map((stat) => stat.matches))} matches`,
    };
  }

  if (stats.some((stat) => stat.status === 'ranking-too-small')) {
    return {
      kind: 'waiting',
      heading: WAITING_FOR_HEROES,
      progress: `Has enough matches. Scores start once ${answer.minimums.rankedHeroes} heroes qualify.`,
      percent: 100,
    };
  }

  const furthest = stats
    .filter((stat) => stat.status === 'collecting')
    .reduce<HeroScoreStat | null>((best, stat) => (best === null || stat.matches > best.matches ? stat : best), null);

  return {
    kind: 'waiting',
    heading: COLLECTING,
    progress: progressLabel(furthest, answer),
    percent: Math.min(100, ((furthest?.matches ?? 0) / answer.minimums.matches) * 100),
  };
}

/** How many heroes have at least one score, for the line above the team. */
export function heroesWithScores(answer: HeroScoresAnswer): number {
  return (answer?.heroes ?? []).filter((hero) => matchStatsOf(hero).some((stat) => stat.status === 'scored')).length;
}

/**
 * The team's signals: an average out of 10 across the chosen heroes with a number for that signal,
 * saying how many of the full team it rests on. A hero without a number is left out, never read as 0.
 */
export function teamBuildSignals(
  heroes: readonly { id: string; name: string }[],
  answer: HeroScoresAnswer,
  teamSize: number,
): BuildSignalRow[] {
  const heroRows = heroes.map((hero) => ({ hero, rows: heroBuildSignals(hero.id, answer) }));

  return SIGNAL_TYPES.map((type, index) => {
    const withNumber = heroRows.flatMap(({ hero, rows }) => {
      const { value } = rows[index];

      return value === null ? [] : [{ name: hero.name, value }];
    });
    const uses = `Uses ${withNumber.length} of ${teamSize} heroes`;

    if (withNumber.length === 0) {
      const detail = answer === null && type !== 'Mobility' ? CANNOT_LOAD : `${uses}.`;
      const reasons = heroRows.map(({ rows }) => rows[index].valueLabel);

      return withoutNumber(type, teamReason(reasons), detail, null);
    }

    const average = withNumber.reduce((sum, { value }) => sum + value, 0) / withNumber.length;
    const valueLabel = average.toFixed(1);
    const source = sourceOf(type);
    const notMeasurable = heroRows.filter(({ rows }) => rows[index].valueLabel === NOT_MEASURABLE).length;

    return {
      type,
      source,
      value: average,
      used: withNumber.length,
      valueLabel,
      detail: teamDetail(type, uses, withNumber.map(({ name }) => name), notMeasurable),
      figures: null,
      ariaLabel: `${type} ${valueLabel} out of 10, ${source.toLowerCase()}. ${uses}.`,
    };
  });
}

/** The hero's per-ability use, one row per slot that passes the rule on its own. */
export function heroAbilityUseRows(heroId: string, answer: HeroScoresAnswer): HeroAbilityUseRow[] {
  const entry = answer ? heroEntry(answer, heroId) : undefined;

  return (entry?.abilities ?? []).map((ability) => ({
    slot: ability.slot,
    keyLabel: KEY_LABELS[ability.slot] ?? ability.slot,
    ability: ability.ability ?? 'Several abilities on this key',
    type: ability.slot === 'ultimate' ? 'Ultimate' : (ability.tag ?? 'Not tagged'),
    uses: ability.usesPerTenMinutes.toFixed(1),
    takedowns: ability.takedownsPerUse === null ? 'Not recorded' : ability.takedownsPerUse.toFixed(2),
    matches: String(ability.matches),
  }));
}

function sourceOf(type: HeroBuildType): BuildSignalSource {
  if (type === 'Mobility') {
    return 'Hero kit';
  }

  return type === 'Damage' || type === 'Sustain' ? 'Measured' : 'Estimated';
}

function heroEntry(answer: CommunityHeroScores, heroId: string): HeroScores | undefined {
  return answer.heroes.find((hero) => hero.hero === heroId);
}

function matchStatsOf(hero: HeroScores | undefined): HeroScoreStat[] {
  return hero ? [hero.damage, hero.sustain, hero.ultimate, hero.utility] : [];
}

function mobilityRow(heroId: string): BuildSignalRow {
  const value = heroKitMobilityValue(heroId);

  if (value === null) {
    return withoutNumber('Mobility', NO_KIT_VALUE, "This hero's kit has not been rated yet.", null);
  }

  return {
    type: 'Mobility',
    source: 'Hero kit',
    value,
    used: 1,
    valueLabel: String(value),
    detail: 'A fixed value for the hero, from their kit. The game sends no movement data.',
    figures: null,
    ariaLabel: `Mobility ${value} out of 10, hero kit.`,
  };
}

function matchSignalRow(type: MatchSignal, heroId: string, answer: HeroScoresAnswer): BuildSignalRow {
  if (answer === undefined) {
    return withoutNumber(type, LOADING, '', null);
  }

  if (answer === null) {
    return withoutNumber(type, UNAVAILABLE, CANNOT_LOAD, null);
  }

  const stat = heroEntry(answer, heroId)?.[STAT_KEYS[type]];

  if (stat?.status === 'scored' && stat.score !== null) {
    const source = sourceOf(type);

    return {
      type,
      source,
      value: stat.score,
      used: 1,
      valueLabel: String(stat.score),
      detail: `From ${stat.matches} matches. ${WHAT_IS_COUNTED[type]}`,
      figures: figuresLabel(type, stat),
      ariaLabel: `${type} ${stat.score} out of 10, ${source.toLowerCase()}.`,
    };
  }

  if (stat?.status === 'ranking-too-small') {
    return withoutNumber(
      type,
      WAITING_FOR_HEROES,
      `This hero has enough matches. Scores start once ${answer.minimums.rankedHeroes} heroes qualify.`,
      figuresLabel(type, stat),
    );
  }

  if (stat?.status === 'no-measurable-ability') {
    return withoutNumber(
      type,
      NOT_MEASURABLE,
      'The app can only measure this from a Utility ability with a plain cooldown, and this hero has none. This is not a low score.',
      null,
    );
  }

  return {
    ...withoutNumber(type, COLLECTING, progressLabel(stat ?? null, answer), null),
    collection: { matches: stat?.matches ?? 0, minimum: answer.minimums.matches },
  };
}

function withoutNumber(
  type: HeroBuildType,
  valueLabel: string,
  detail: string,
  figures: string | null,
): BuildSignalRow {
  return {
    type,
    source: sourceOf(type),
    value: null,
    used: 0,
    valueLabel,
    detail,
    figures,
    ariaLabel: detail ? `${type}: ${valueLabel}. ${detail}` : `${type}: ${valueLabel}.`,
  };
}

/**
 * Match counts arrive in steps of 5 while a hero is below the rule, so an exact count never shows.
 * One busy player can hold a hero back past both minimums, so the counts stop at each minimum. The
 * busiest player is only named as the reason while the minimums cap a player's share, once there are
 * enough players for it to be one, and by the share the minimums publish (the flag means "above that share").
 */
function progressLabel(stat: HeroScoreStat | null, answer: CommunityHeroScores): string {
  const { matches, contributors, busiestContributorShare } = answer.minimums;
  const matchesSoFar = Math.min(stat?.matches ?? 0, matches);
  const playersSoFar = Math.min(stat?.contributors ?? 0, contributors);

  if (contributors === 1 && busiestContributorShare === 1) {
    return `${matchesSoFar} of ${matches} matches`;
  }

  const progress = `${matchesSoFar} of ${matches} matches, ${playersSoFar} of ${contributors} players`;

  return busiestContributorShare < 1 && stat?.oneContributorAboveHalf && (stat.contributors ?? 0) >= contributors
    ? `${progress}. One player has more than ${shareLabel(busiestContributorShare)} of these matches, so it needs more players.`
    : progress;
}

/** "half" for the starting rule, otherwise the share as a percentage. */
function shareLabel(share: number): string {
  return share === 0.5 ? 'half' : `${Math.round(share * 100)}%`;
}

function teamDetail(type: HeroBuildType, uses: string, names: readonly string[], notMeasurable: number): string {
  if (type === 'Mobility') {
    return `${uses}. From each hero's kit, not match data.`;
  }

  const left = notMeasurable > 0 ? ` Not measurable yet for ${countLabel(notMeasurable, 'hero', 'heroes')}.` : '';

  return `${uses}: ${names.join(', ')}.${left}`;
}

/** Why a team has no number: the heroes' shared reason, or collecting when they differ. */
function teamReason(reasons: readonly string[]): string {
  const [first] = reasons;

  return first !== undefined && reasons.every((reason) => reason === first) ? first : COLLECTING;
}

function figuresLabel(type: MatchSignal, stat: HeroScoreStat): string | null {
  const { measures } = stat;

  if (!measures) {
    return null;
  }

  switch (type) {
    case 'Damage':
      return `${whole(measures['damagePerMinute'])} damage per minute`;
    case 'Sustain':
      return `${sustainParts(measures).join(' and ')} per minute`;
    case 'Ultimate':
      return `${measures['usesPerTenMinutes']} ultimates per 10 minutes, ${measures['takedownsPerUse']} kills or assists after each`;
    case 'Utility':
      return `Used ${Math.round(measures['useOfAvailable'] * 100)}% of what its cooldowns allowed, ${measures['takedownsPerUse']} kills or assists per use`;
  }
}

/** A figure the feed never sent for this hero is absent, not 0, so it is left out of the sentence. */
function sustainParts(measures: Record<string, number>): string[] {
  const healing = measures['healingPerMinute'];
  const blocked = measures['blockedPerMinute'];

  return [
    ...(healing === undefined ? [] : [`${whole(healing)} healing`]),
    ...(blocked === undefined ? [] : [`${whole(blocked)} blocked`]),
  ];
}

function whole(value: number): string {
  return value.toLocaleString('en-US');
}

function signalTile(row: BuildSignalRow): HeroSignalTile {
  return {
    type: row.type,
    shortLabel: SHORT_LABELS[row.type],
    source: row.source,
    valueLabel: row.value === null ? '–' : row.valueLabel,
    ariaLabel:
      row.value === null
        ? `${row.type}: ${row.valueLabel}`
        : `${row.type} ${row.valueLabel} out of 10, ${row.source.toLowerCase()}`,
  };
}
