import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';

/**
 * The counter surfaces share these reads: pair performance compared with each hero's overall
 * performance. Nothing here scores a hero or says whom to ban.
 */

/** Minimum advantage over a hero's overall shrunk win rate, matching the overlay. */
export const MINIMUM_COUNTER_EDGE = 0.03;
const EDGE_ROUNDING_TOLERANCE = 1e-9;

/** Whether the matchup outperforms this hero's overall record by the shared community threshold. */
export function hasCounterAdvantage(matchup: HeroMatchup): boolean {
  return matchup.edge >= MINIMUM_COUNTER_EDGE - EDGE_ROUNDING_TOLERANCE;
}

/** The counter advantages against `enemyId`. */
export function winningRecordsAgainst(matchups: HeroMatchups, enemyId: string): HeroMatchup[] {
  return matchups.matchups.filter((matchup) => matchup.enemy === enemyId && hasCounterAdvantage(matchup));
}

/** `heroId`'s own counter advantages against other heroes. */
export function winningRecordsOf(matchups: HeroMatchups, heroId: string): HeroMatchup[] {
  return matchups.matchups.filter((matchup) => matchup.hero === heroId && hasCounterAdvantage(matchup));
}

/**
 * The `limit` counter advantages with the clearest edge, then the larger sample and hero ids for a
 * stable order.
 */
export function strongestRecords(matchups: HeroMatchups, limit: number): HeroMatchup[] {
  return matchups.matchups
    .filter(hasCounterAdvantage)
    .sort(
      (a, b) =>
        b.edge - a.edge ||
        b.matches - a.matches ||
        a.hero.localeCompare(b.hero) ||
        a.enemy.localeCompare(b.enemy),
    )
    .slice(0, Math.max(0, limit));
}

/** How many enemy heroes `heroId` has a counter advantage against. */
export function matchupCountOf(matchups: HeroMatchups, heroId: string): number {
  return matchups.matchups.filter((matchup) => matchup.hero === heroId && hasCounterAdvantage(matchup)).length;
}

/** The record against one enemy hero, or undefined when it is below the minimum. */
export function matchupBetween(matchups: HeroMatchups, heroId: string, enemyId: string): HeroMatchup | undefined {
  return matchups.matchups.find((matchup) => matchup.hero === heroId && matchup.enemy === enemyId);
}

/** "75.0%" for a record, the figure a card shows. */
export function recordWinRateLabel(matchup: HeroMatchup): string {
  return percentLabel(matchup.winRate);
}

/** "12 matches" for a record, the sample behind the figure. */
export function recordSampleLabel(matchup: HeroMatchup): string {
  return countLabel(matchup.matches, 'match', 'matches');
}

/** The sentence a card carries as its tooltip, such as "Hulk won 9 of 12 against Thor (75.0%) in 12 matches". */
export function recordSentence(matchup: HeroMatchup, heroName: string, enemyName: string): string {
  return `${heroName} won ${matchup.wins} of ${matchup.appearances} against ${enemyName} (${recordWinRateLabel(matchup)}) in ${recordSampleLabel(matchup)}.`;
}

/** The part of a roster hero a card needs. */
export interface RosterHero {
  id: string;
  name: string;
  imageUrl: string;
}

/** One hero on a record, with the figures and sentence its card shows. */
export interface RecordCard<H extends RosterHero> {
  hero: H;
  /** Matches behind the record, used as the first tie-breaker after edge. */
  matches: number;
  edge: number;
  winRate: string;
  sample: string;
  /** The record in words, for the card's tooltip. */
  description: string;
}

/**
 * Turns records into cards, strongest shared edge first and then by sample and hero name. `shown`
 * picks which hero of the record the card pictures; the sentence always reads winner against loser.
 * A record naming a hero the roster does not know is left out rather than shown half-blank.
 */
export function recordCards<H extends RosterHero>(
  rows: readonly HeroMatchup[],
  shown: 'hero' | 'enemy',
  roster: readonly H[],
): RecordCard<H>[] {
  const byId = new Map(roster.map((hero) => [hero.id, hero]));

  const cards = rows.flatMap((matchup) => {
    const portrait = byId.get(matchup[shown]);
    const winner = byId.get(matchup.hero);
    const loser = byId.get(matchup.enemy);

    return portrait === undefined || winner === undefined || loser === undefined
      ? []
      : [
          {
            hero: portrait,
            matches: matchup.matches,
            edge: matchup.edge,
            winRate: recordWinRateLabel(matchup),
            sample: recordSampleLabel(matchup),
            description: recordSentence(matchup, winner.name, loser.name),
          },
        ];
  });

  return cards.sort((a, b) => b.edge - a.edge || b.matches - a.matches || a.hero.name.localeCompare(b.hero.name));
}
