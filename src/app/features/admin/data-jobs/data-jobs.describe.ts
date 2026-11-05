import type { DataJobDetail, DataJobOutcome, DataJobRun } from '../../../../contracts/admin-data-jobs.model';

/**
 * How a run is worded on the page. Success is never the default word: a game stats capture that
 * stored nothing, or stored built-in numbers, is told as what it was.
 */
export type Tone = 'good' | 'notice' | 'warning' | 'bad';

export interface RunWords {
  tone: Tone;
  /** One sentence on what happened. */
  headline: string;
  /** Anything more worth knowing, or null. */
  note: string | null;
}

/** `2026-11-04 10:10 UTC`, read off the ISO instant so it does not depend on the visitor's time zone. */
export function utcLabel(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export function describeDetail(detail: DataJobDetail): RunWords {
  switch (detail.result) {
    case 'rebuilt':
      return detail.halfSeasons === 0
        ? { tone: 'notice', headline: 'Nothing to rebuild: no half-season with data is still open.', note: null }
        : {
            tone: 'good',
            headline: `Rebuilt ${plural(detail.halfSeasons, 'half-season', 'half-seasons')}.`,
            note: 'A half-season that is frozen is left as it was.',
          };
    case 'news-synced':
      return { tone: 'good', headline: `Home news refreshed with ${plural(detail.cards, 'card', 'cards')}.`, note: null };
    case 'stored':
      return {
        tone: 'good',
        headline: `Stored a new capture for ${utcLabel(detail.capturedAt)}, with all ${detail.games} player counts read from Steam.`,
        note: null,
      };
    case 'stored-with-fallbacks':
      return {
        tone: 'warning',
        headline:
          `Stored a capture, but Steam did not answer for ${detail.fallbackGames} of ${detail.games} games, ` +
          'so their player counts are built-in fallback numbers.',
        note: 'The hour keeps the first capture it gets, so a later run in the same hour will not replace these.',
      };
    case 'already-captured':
      return {
        tone: 'notice',
        headline: `Nothing new was stored: this hour was already captured at ${utcLabel(detail.capturedAt)}.`,
        note:
          (detail.fallbackGames > 0
            ? `Steam did not answer for ${detail.fallbackGames} of ${detail.games} games on this run, and none of what it read was kept. `
            : '') + 'Opening the game stats page can also take the hour. The next hour will store a new capture.',
      };
    case 'failed':
      return { tone: 'bad', headline: detail.message, note: null };
  }
}

const OUTCOME_WORDS: Record<DataJobOutcome, RunWords> = {
  succeeded: { tone: 'good', headline: 'Succeeded.', note: null },
  failed: { tone: 'bad', headline: 'Failed.', note: null },
  running: { tone: 'notice', headline: 'Running.', note: null },
  unfinished: {
    tone: 'warning',
    headline: 'Did not finish.',
    note: 'It started and never reported how it ended. Its server may have stopped, so check the data before relying on it.',
  },
};

/** A run from the history. A finished manual run is told by what it came to; the rest by how it ended. */
export function describeRun(run: DataJobRun): RunWords {
  if (run.outcome === 'unfinished' || run.outcome === 'running') {
    return OUTCOME_WORDS[run.outcome];
  }

  if (run.detail) {
    return describeDetail(run.detail);
  }

  const words = OUTCOME_WORDS[run.outcome];

  return { ...words, note: run.message ?? words.note };
}
