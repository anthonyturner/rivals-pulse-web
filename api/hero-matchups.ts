import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroMatchups } from '../src/server/heroes/matchups/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroMatchups());
}
