import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroSwitchIns } from '../src/server/heroes/switch-ins/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getHeroSwitchIns());
}
