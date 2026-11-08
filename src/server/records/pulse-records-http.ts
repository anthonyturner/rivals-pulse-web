import type { IncomingMessage, ServerResponse } from 'http';

import { handleJsonRequest } from '../http/index.ts';
import { getPulseRecords } from './pulse-records-read.ts';

/**
 * A name is published only while its owner has naming on, so a shared cache may keep an answer for
 * a minute and no longer: no stale window. A player who switches naming off is gone from the boards
 * within two minutes, one for this copy to expire and one for a copy already on its way.
 * `scripts/pulse-records-route.test.ts` holds the limit.
 */
export const PULSE_RECORDS_CACHE_CONTROL = 'public, max-age=0, s-maxage=60';

/** `GET /api/records`, the same for the Vercel function and the Express route. */
export function handlePulseRecordsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  read: () => Promise<unknown> = () => getPulseRecords(),
): Promise<void> {
  return handleJsonRequest(req, res, read, { cacheControl: PULSE_RECORDS_CACHE_CONTROL });
}
