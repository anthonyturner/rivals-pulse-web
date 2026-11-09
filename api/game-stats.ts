import type { IncomingMessage, ServerResponse } from 'http';

import { getGameCounts } from '../src/server/game-counts/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getGameCounts(), { allowCors: true });
}
