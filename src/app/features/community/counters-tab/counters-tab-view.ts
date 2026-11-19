import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import { COUNTER_MIN_EDGE_POINTS } from '../../../../contracts/hero-matchups.model';
import {
  counterRuleNote,
  recordEdgeLabel,
  recordSampleLabel,
  recordSentence,
  recordWinRateLabel,
  strongestRecords,
} from '../../insights/hero-matchup-records';

/** Matchups listed: a summary, not the whole counters tool. */
export const COUNTERS_TAB_RECORDS = 6;

interface RecordHero {
  hero: string;
  name: string;
  imageUrl: string;
}

export interface CounterRecordView {
  key: string;
  winner: RecordHero;
  loser: RecordHero;
  winRate: string;
  /** How far the record sits above the hero's usual win rate, such as "+3.3 pts vs usual". */
  edge: string;
  sample: string;
  /** The record in words, for the row's tooltip. */
  description: string;
}

export type CountersTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      /** The caveat under the records: what they are, and what they do not say. */
      footnote: string;
      records: CounterRecordView[];
    };

/**
 * What the Counters tab shows: the counters with the clearest edge over the hero's usual win rate, read from the same
 * matchups as the hero pages and the counters tool. A record describes what happened in matches; it
 * does not say whom to pick or ban. `undefined` means the matchups have not answered yet and `null`
 * means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildCountersTabView(
  matchups: HeroMatchups | null | undefined,
  identities: HeroIdentities,
): CountersTabView {
  if (matchups === undefined) {
    return { kind: 'loading' };
  }

  if (matchups === null) {
    return { kind: 'unavailable' };
  }

  const strongest = matchups.status === 'ready' ? strongestRecords(matchups, COUNTERS_TAB_RECORDS) : [];

  if (strongest.length === 0) {
    return {
      kind: 'not-enough-data',
      summary: `No hero does at least ${COUNTER_MIN_EDGE_POINTS} points better against another hero than it usually does yet. A matchup can count once two heroes have faced each other in ${countLabel(matchups.minimumMatches, 'recorded match', 'recorded matches')}.`,
    };
  }

  const halfSeasonLabel = matchups.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      matchups.inPlaceOf === null ? null : halfSeasonFallbackNotice(matchups.inPlaceOf.label, halfSeasonLabel),
    footnote: `${counterRuleNote(matchups.minimumMatches)} These come from matches RivalsPulse players recorded, ordered by how clear the edge is. They describe what happened; they do not say whom to pick or ban.`,
    records: strongest.map((record) => {
      const winner = heroCell(record.hero, identities);
      const loser = heroCell(record.enemy, identities);

      return {
        key: `${record.hero}>${record.enemy}`,
        winner: { hero: winner.hero, name: winner.name, imageUrl: winner.imageUrl },
        loser: { hero: loser.hero, name: loser.name, imageUrl: loser.imageUrl },
        winRate: recordWinRateLabel(record),
        edge: recordEdgeLabel(record),
        sample: recordSampleLabel(record),
        description: recordSentence(record, winner.name, loser.name),
      };
    }),
  };
}
