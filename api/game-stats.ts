import type { IncomingMessage, ServerResponse } from 'http';

import { syncGameStats } from '../src/server/sync/index.js';
import { getSupabaseClient } from '../src/server/supabase/index.js';
import { handleJsonRequest } from '../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => syncGameStats(getSupabaseClient()), { allowCors: true });
}
