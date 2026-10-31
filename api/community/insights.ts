import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityInsights } from '../../src/community-insights-read.js';
import { handleJsonRequest } from '../../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getCommunityInsights());
}
