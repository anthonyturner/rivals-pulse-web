import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroPairs } from '../src/hero-pairs-read.js';
import { handleJsonRequest } from '../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroPairs());
}
