import type { IncomingMessage, ServerResponse } from 'http';

import { getContentStatusFromDatabase } from '../../src/server/content/index.js';
import { handleJsonRequest } from '../../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => getContentStatusFromDatabase());
}
