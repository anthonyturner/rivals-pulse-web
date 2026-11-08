import type { IncomingMessage, ServerResponse } from 'http';

import { getTeamLineups } from '../src/server/heroes/lineups/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getTeamLineups());
}
