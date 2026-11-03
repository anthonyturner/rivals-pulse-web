import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroPairs } from '../src/server/heroes/pairs/hero-pairs-read.js';
import { handleJsonRequest } from '../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroPairs());
}
