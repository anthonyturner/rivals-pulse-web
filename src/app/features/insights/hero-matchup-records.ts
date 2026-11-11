import { COUNTER_MIN_EDGE_POINTS, type HeroMatchup, type HeroMatchups } from '../../../contracts/hero-matchups.model';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';

/**
 * The reads every counter surface shares. They describe a record: who counters a hero, and whom that
 * hero counters. Whether a pair counts is the server's one community rule, sent as `isCounter`, so
 * these lists hold the same pairs as the overlay's community counters. Nothing here scores a hero or
 * says whom to ban.
 */

/** The matchups of a hero that counters `enemyId`. */
export function winningRecordsAgainst(matchups: HeroMatchups, enemyId: string): HeroMatchup[] {
  return matchups.matchups.filter((matchup) => matchup.enemy === enemyId && matchup.isCounter);
}

/** `heroId`'s own matchups where it counters the enemy. */
export function winningRecordsOf(matchups: HeroMatchups, heroId: string): HeroMatchup[] {
  return matchups.matchups.filter((matchup) => matchup.hero === heroId && matchup.isCounter);
}

/**
 * The `limit` counters with the clearest edge: largest edge over the hero's own record first, then
 * the larger sample, then hero ids so the order never changes between reads. A short run cannot lead
 * the list, because the edge is measured on shrunk rates.
 */
export function strongestRecords(matchups: HeroMatchups, limit: number): HeroMatchup[] {
  return matchups.matchups
    .filter((matchup) => matchup.isCounter)
    .sort(
      (a, b) =>
        b.edge - a.edge ||
        b.matches - a.matches ||
        a.hero.localeCompare(b.hero) ||
        a.enemy.localeCompare(b.enemy),
    )
    .slice(0, Math.max(0, limit));
}

/** How many enemy heroes `heroId` has a record against that is large enough to show. */
export function matchupCountOf(matchups: HeroMatchups, heroId: string): number {
  return matchups.matchups.filter((matchup) => matchup.hero === heroId).length;
}

/** The record against one enemy hero, or undefined when it is below the minimum. */
export function matchupBetween(matchups: HeroMatchups, heroId: string, enemyId: string): HeroMatchup | undefined {
  return matchups.matchups.find((matchup) => matchup.hero === heroId && matchup.enemy === enemyId);
}

/** "+3.3 pts vs usual": how far a record sits above (or below) the hero's own usual win rate, the figure that decides a counter. */
export function recordEdgeLabel(matchup: HeroMatchup): string {
  const points = Math.round(matchup.edge * 10) / 10;

  return points === 0 ? 'Even with usual' : `${points > 0 ? '+' : '−'}${Math.abs(points).toFixed(1)} pts vs usual`;
}

/**
 * The rule every counter list follows, in words, for the footnote under it. The Rivals Pulse app
 * lists counters by the same rule.
 */
export function counterRuleNote(minimumMatches: number): string {
  return `A hero is listed when its win rate against the other, adjusted for small samples, is at least ${COUNTER_MIN_EDGE_POINTS} points above its own usual win rate, over at least ${minimumMatches} recorded matches. The Rivals Pulse app uses the same rule.`;
}

/**
 * The empty state of a counter list: it names how many heroes were checked, so "none" reads as a
 * finding and not as missing data. `heroId` is the hero the list is about; `side` is whether the
 * list holds the heroes that do better against it or the heroes it does better against.
 */
export function noCounterMessage(matchups: HeroMatchups, heroId: string, heroName: string, side: 'against' | 'for'): string {
  const checked = matchups.matchups.filter((matchup) => (side === 'against' ? matchup.enemy : matchup.hero) === heroId).length;
  const recorded = `${matchups.minimumMatches} or more recorded matches`;

  if (checked === 0) {
    return side === 'against' ? `No hero has ${recorded} against ${heroName} yet.` : `${heroName} has no ${recorded} against another hero yet.`;
  }

  const heroes = checked === 1 ? '1 hero' : `${checked} heroes`;

  return side === 'against'
    ? `No hero does at least ${COUNTER_MIN_EDGE_POINTS} points better against ${heroName} than it usually does, across the ${heroes} with ${recorded} against ${heroName}.`
    : `${heroName} does not do at least ${COUNTER_MIN_EDGE_POINTS} points better than usual against any of the ${heroes} it has ${recorded} against.`;
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
  /** Matches behind the record: what cards are ordered by. */
  matches: number;
  winRate: string;
  /** How far the record sits above the hero's usual win rate, such as "+3.3 pts vs usual". */
  edge: string;
  sample: string;
  /** The record in words, for the card's tooltip. */
  description: string;
}

/**
 * Turns records into cards, largest sample first and then by hero name, so the order says how much
 * a card rests on and never which record is strongest. `shown` picks which hero of the record the card
 * pictures; the sentence always reads winner against loser. A record naming a hero the roster does
 * not know is left out rather than shown half-blank.
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
            winRate: recordWinRateLabel(matchup),
            edge: recordEdgeLabel(matchup),
            sample: recordSampleLabel(matchup),
            description: recordSentence(matchup, winner.name, loser.name),
          },
        ];
  });

  return cards.sort((a, b) => b.matches - a.matches || a.hero.name.localeCompare(b.hero.name));
}
