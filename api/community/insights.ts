import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityInsights } from '../../src/server/community/insights/community-insights-read.js';
import { handleJsonRequest } from '../../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getCommunityInsights());
}
