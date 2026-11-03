import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroPairs } from '../src/server/heroes/pairs/index.js';
import { handleJsonRequest } from '../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroPairs());
}
