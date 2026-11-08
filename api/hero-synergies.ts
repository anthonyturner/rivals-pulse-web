import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroSynergies } from '../src/server/heroes/pairs/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroSynergies());
}
