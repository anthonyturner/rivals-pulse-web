import type { IncomingMessage, ServerResponse } from 'http';

import { getHomeContentBlocksFromDatabase } from '../../src/content-database.js';
import { handleJsonRequest } from '../../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(
    req,
    res,
    () => getHomeContentBlocksFromDatabase(),
    { cacheControl: 'private, no-store, max-age=0' },
  );
}
