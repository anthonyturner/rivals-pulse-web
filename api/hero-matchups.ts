import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroMatchups } from '../src/hero-matchups-read.js';
import { handleJsonRequest } from '../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroMatchups());
}
