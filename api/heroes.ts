import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroesFromDatabase } from '../src/server/content/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroesFromDatabase(), { allowCors: true });
}
