import type { IncomingMessage, ServerResponse } from 'http';

import { handleJsonRequest } from '../http/index.ts';

/**
 * A name is published only while its owner has naming on, so a shared cache may keep an answer for
 * a minute and no longer: no stale window. A player who switches naming off is gone from the boards
 * within two minutes, one for this copy to expire and one for a copy already on its way.
 * `scripts/pulse-records-route.test.ts` holds the limit.
 */
export const PULSE_RECORDS_CACHE_CONTROL = 'public, max-age=0, s-maxage=60';

/**
 * Answers `GET /api/records` from `read` with the records cache header. It takes the read rather
 * than importing it, so it loads without the Supabase client; `handlePulseRecordsRequest` in
 * `index.ts` binds the real read.
 */
export function respondWithPulseRecords(
  req: IncomingMessage,
  res: ServerResponse,
  read: () => Promise<unknown>,
): Promise<void> {
  return handleJsonRequest(req, res, read, { cacheControl: PULSE_RECORDS_CACHE_CONTROL });
}
