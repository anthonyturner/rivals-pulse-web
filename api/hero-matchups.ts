import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroMatchups } from '../src/server/heroes/matchups/hero-matchups-read.js';
import { handleJsonRequest } from '../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroMatchups());
}
