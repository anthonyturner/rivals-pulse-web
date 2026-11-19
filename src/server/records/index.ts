import type { IncomingMessage, ServerResponse } from 'http';

import { respondWithPulseRecords } from './pulse-records-http.ts';
import { getPulseRecords } from './pulse-records-read.ts';

export { getPulseRecords } from './pulse-records-read.ts';
export { PULSE_RECORDS_CACHE_CONTROL } from './pulse-records-http.ts';

/** `GET /api/records`, the same for the Vercel function and the Express route. */
export function handlePulseRecordsRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return respondWithPulseRecords(req, res, () => getPulseRecords());
}
