import type { DataJobDetail, DataJobOutcome, DataJobRun } from '../../../../contracts/admin-data-jobs.model';

/**
 * How a run is worded on the page. Success is never the default word: a rebuild that found
 * nothing to rebuild is told as what it was.
 */
export type Tone = 'good' | 'notice' | 'warning' | 'bad';

export interface RunWords {
  tone: Tone;
  /** One sentence on what happened. */
  headline: string;
  /** Anything more worth knowing, or null. */
  note: string | null;
}

/** The site owner reads this page in US Eastern time, whatever time zone the browser is in. */
const EASTERN = {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
} as const satisfies Intl.DateTimeFormatOptions;

const easternMinutes = new Intl.DateTimeFormat('en-US', EASTERN);
const easternSeconds = new Intl.DateTimeFormat('en-US', { ...EASTERN, second: '2-digit' });

/** Newer browsers put a narrow no-break space before AM and PM; plain spaces read and match the same everywhere. */
const plainSpaces = (text: string): string => text.replace(/\s/g, ' ');

/** `Nov 4, 2026, 5:10 AM EST`, or EDT while daylight saving applies. */
export function easternLabel(iso: string): string {
  return plainSpaces(easternMinutes.format(new Date(iso)));
}

/** As `easternLabel` with the seconds, for a time to try again at: cutting them off would name a minute that is still too early. */
export function easternTimeLabel(iso: string): string {
  return plainSpaces(easternSeconds.format(new Date(iso)));
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
