import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroStats } from '../src/hero-stats-read.js';
import { handleJsonRequest } from '../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroStats());
}
