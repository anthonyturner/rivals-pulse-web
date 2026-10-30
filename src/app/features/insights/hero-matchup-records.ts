import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';

/**
 * The reads both counter surfaces share. They describe a record: who has a winning one against a
 * hero, and who that hero has one against. Nothing here scores a hero or says whom to ban.
 */

/** A shrunk win rate above this is a winning record; it is an even one at 50. */
export const WINNING_RECORD_CUT_OFF = 50;

/** Whether `hero` wins more than it loses against `enemy`, once a short run is pulled toward even. */
export function hasWinningRecord(matchup: HeroMatchup): boolean {
  return matchup.shrunkWinRate > WINNING_RECORD_CUT_OFF;
}

/** The matchups of a hero that has a winning record against `enemyId`, best record first. */
export function winningRecordsAgainst(matchups: HeroMatchups, enemyId: string): HeroMatchup[] {
  return byRecord(matchups.matchups.filter((matchup) => matchup.enemy === enemyId && hasWinningRecord(matchup)));
}

/** `heroId`'s own matchups where it has a winning record, best record first. */
export function winningRecordsOf(matchups: HeroMatchups, heroId: string): HeroMatchup[] {
  return byRecord(matchups.matchups.filter((matchup) => matchup.hero === heroId && hasWinningRecord(matchup)));
}

/** How many enemy heroes `heroId` has a record against that is large enough to show. */
export function matchupCountOf(matchups: HeroMatchups, heroId: string): number {
  return matchups.matchups.filter((matchup) => matchup.hero === heroId).length;
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
  winRate: string;
  sample: string;
  /** The record in words, for the card's tooltip. */
  description: string;
}

/**
 * Turns records into cards, keeping their order. `shown` picks which hero of the record the card
 * pictures; the sentence always reads winner against loser. A record naming a hero the roster does
 * not know is left out rather than shown half-blank.
 */
export function recordCards<H extends RosterHero>(
  rows: readonly HeroMatchup[],
  shown: 'hero' | 'enemy',
  roster: readonly H[],
): RecordCard<H>[] {
  const byId = new Map(roster.map((hero) => [hero.id, hero]));

  return rows.flatMap((matchup) => {
    const portrait = byId.get(matchup[shown]);
    const winner = byId.get(matchup.hero);
    const loser = byId.get(matchup.enemy);

    return portrait === undefined || winner === undefined || loser === undefined
      ? []
      : [
          {
            hero: portrait,
            winRate: recordWinRateLabel(matchup),
            sample: recordSampleLabel(matchup),
            description: recordSentence(matchup, winner.name, loser.name),
          },
        ];
  });
}

// Best shrunk record first; ties fall to the larger sample and then the hero id so the order is stable.
function byRecord(matchups: HeroMatchup[]): HeroMatchup[] {
  return [...matchups].sort(
    (a, b) => b.shrunkWinRate - a.shrunkWinRate || b.matches - a.matches || a.hero.localeCompare(b.hero) || a.enemy.localeCompare(b.enemy),
  );
}
