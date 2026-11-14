/**
 * How many `tracked_matches` rows one player keeps; the oldest beyond it are deleted on upload.
 *
 * The participants backfill (issue 143) replays these rows, so the cap must sit well above any
 * player's history until it has run: 5,000 is roughly a year for the heaviest player so far. Rows
 * stay about a kilobyte, so the table still cannot grow without limit. Lower it only after the
 * backfill has run.
 */
export const MAX_TRACKED_MATCHES_PER_PLAYER = 5_000;

/** Most surplus rows removed per upload; the usual surplus is one, so this only bounds a catch-up. */
export const TRACKED_MATCH_TRIM_BATCH = 100;
