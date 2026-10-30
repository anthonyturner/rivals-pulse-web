import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import {
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
      records: CounterRecordView[];
    };

/**
 * What the Counters tab shows: the winning records with the clearest edge, read from the same
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
      summary: `No hero has a winning record against another yet. A matchup appears once two heroes have faced each other in ${countLabel(matchups.minimumMatches, 'recorded match', 'recorded matches')}.`,
    };
  }

  const halfSeasonLabel = matchups.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      matchups.inPlaceOf === null ? null : halfSeasonFallbackNotice(matchups.inPlaceOf.label, halfSeasonLabel),
    records: strongest.map((record) => {
      const winner = heroCell(record.hero, identities);
      const loser = heroCell(record.enemy, identities);

      return {
        key: `${record.hero}>${record.enemy}`,
        winner: { hero: winner.hero, name: winner.name, imageUrl: winner.imageUrl },
        loser: { hero: loser.hero, name: loser.name, imageUrl: loser.imageUrl },
        winRate: recordWinRateLabel(record),
        sample: recordSampleLabel(record),
        description: recordSentence(record, winner.name, loser.name),
      };
    }),
  };
}
