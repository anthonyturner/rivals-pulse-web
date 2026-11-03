import type { IncomingMessage, ServerResponse } from 'http';

import { syncGameStats } from '../src/server/sync/game-stats-sync.js';
import { getSupabaseClient } from '../src/server/supabase/supabase-client.js';
import { handleJsonRequest } from '../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => syncGameStats(getSupabaseClient()), { allowCors: true });
}
