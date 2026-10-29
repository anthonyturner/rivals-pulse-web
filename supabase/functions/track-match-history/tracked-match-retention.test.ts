import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_TRACKED_MATCHES_PER_PLAYER, TRACKED_MATCH_TRIM_BATCH } from './tracked-match-retention.ts';

/** The most history one player held when the cap was 500 and every upload began deleting their oldest match. */
const HEAVIEST_HISTORY_SEEN = 500;

describe('tracked match retention', () => {
  it('keeps more than the heaviest history seen, so no upload deletes a match the backfill needs', () => {
    assert.ok(MAX_TRACKED_MATCHES_PER_PLAYER > HEAVIEST_HISTORY_SEEN);
  });

  it('is a whole number of rows and trims a positive, bounded batch', () => {
    assert.ok(Number.isInteger(MAX_TRACKED_MATCHES_PER_PLAYER));
    assert.ok(Number.isInteger(TRACKED_MATCH_TRIM_BATCH) && TRACKED_MATCH_TRIM_BATCH > 0);
    assert.ok(TRACKED_MATCH_TRIM_BATCH <= MAX_TRACKED_MATCHES_PER_PLAYER);
  });
});
