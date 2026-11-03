import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityInsights } from '../../src/server/community/insights/index.js';
import { handleJsonRequest } from '../../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getCommunityInsights());
}
