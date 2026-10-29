/**
 * How many `tracked_matches` rows one player keeps; the oldest beyond it are deleted on upload.
 *
 * It was 500, and the most active player reached exactly 500, so every upload began deleting the
 * history the participants backfill replays (issue 143). 5,000 is about ten times the heaviest
 * history so far (500 rows in 40 days, roughly a year at that pace) while a row stays about a
 * kilobyte, so the table still cannot grow without limit. Lower it only after the backfill has run.
 */
export const MAX_TRACKED_MATCHES_PER_PLAYER = 5_000;

/** Most surplus rows removed per upload; the usual surplus is one, so this only bounds a catch-up. */
export const TRACKED_MATCH_TRIM_BATCH = 100;
