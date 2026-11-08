import type { IncomingMessage, ServerResponse } from 'http';

import { handlePulseRecordsRequest } from '../src/server/records/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handlePulseRecordsRequest(req, res);
}
