import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityInsights } from '../../src/server/community/insights/index.ts';
import { handleJsonRequest } from '../../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getCommunityInsights());
}
