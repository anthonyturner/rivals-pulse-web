import type { IncomingMessage, ServerResponse } from 'http';

import { getTripleSupportTrios } from '../src/server/heroes/trios/index.ts';
import { handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getTripleSupportTrios());
}
