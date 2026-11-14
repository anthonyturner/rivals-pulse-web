import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import {
  counterRuleNote,
  noCounterMessage,
  recordCards,
  type RecordCard,
  type RosterHero,
  winningRecordsAgainst,
  winningRecordsOf,
} from '../../insights/hero-matchup-records';

/** A record card that opens the head-to-head, with the accessible name its button carries. */
export type HeadToHeadCard = RecordCard<RosterHero> & { headToHeadLabel: string };

export type HeroCommunityCountersView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'not-enough-data';
      halfSeasonLabel: string | null;
      fallbackFor: string | null;
      summary: string;
    }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      fallbackFor: string | null;
      /** The shared fallback sentence, set when this is the previous half-season. */
      notice: string | null;
      /** Heroes that do better against this hero than they usually do, by the community counter rule. */
      winningAgainst: HeadToHeadCard[];
      /** Why the first list is empty: how many heroes were checked. */
      noneAgainst: string;
      /** Heroes this hero does better against than it usually does. */
      winningFor: HeadToHeadCard[];
      /** Why the second list is empty. */
      noneFor: string;
      /** The rule behind both lists, in words. */
      ruleNote: string;
    };

/**
 * What a hero page shows for one hero's matchups. `undefined` means the matchups have not answered
 * yet and `null` means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroCommunityCountersView(
  matchups: HeroMatchups | null | undefined,
  heroId: string,
  heroName: string,
  roster: readonly RosterHero[],
): HeroCommunityCountersView {
  if (matchups === undefined) {
    return { kind: 'loading' };
  }

  if (matchups === null) {
    return { kind: 'unavailable' };
  }

  const halfSeasonLabel = matchups.halfSeason?.label ?? null;
  const fallbackFor = matchups.inPlaceOf?.label ?? null;

  if (!matchups.matchups.some((matchup) => matchup.hero === heroId || matchup.enemy === heroId)) {
    const where = fallbackFor === null || halfSeasonLabel === null ? '' : ` in ${halfSeasonLabel}`;
    const needed = `A matchup appears once two heroes have faced each other in ${matchups.minimumMatches} recorded matches.`;

    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      fallbackFor,
      summary:
        matchups.matchups.length === 0
          ? `No two heroes have faced each other in enough matches recorded by RivalsPulse players yet${where}. ${needed}`
          : `${heroName} has not faced another hero in enough matches recorded by RivalsPulse players yet${where}. ${needed}`,
    };
  }

  return {
    kind: 'ready',
    halfSeasonLabel,
    fallbackFor,
    notice: matchups.inPlaceOf === null ? null : halfSeasonFallbackNotice(matchups.inPlaceOf.label, halfSeasonLabel),
    winningAgainst: headToHeadCards(recordCards(winningRecordsAgainst(matchups, heroId), 'hero', roster), heroName),
    noneAgainst: noCounterMessage(matchups, heroId, heroName, 'against'),
    winningFor: headToHeadCards(recordCards(winningRecordsOf(matchups, heroId), 'enemy', roster), heroName),
    noneFor: noCounterMessage(matchups, heroId, heroName, 'for'),
    ruleNote: counterRuleNote(matchups.minimumMatches),
  };
}

function headToHeadCards(cards: RecordCard<RosterHero>[], heroName: string): HeadToHeadCard[] {
  return cards.map((card) => ({
    ...card,
    headToHeadLabel: `Head-to-head: ${heroName} vs ${card.hero.name}. ${card.description}`,
  }));
}
