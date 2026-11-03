import type { IncomingMessage, ServerResponse } from 'http';

import { getContentStatusFromDatabase } from '../../src/server/content/content-database.js';
import { handleJsonRequest } from '../../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getContentStatusFromDatabase());
}
