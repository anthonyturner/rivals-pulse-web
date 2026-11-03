import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroMatchups } from '../src/server/heroes/matchups/index.js';
import { handleJsonRequest } from '../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroMatchups());
}
