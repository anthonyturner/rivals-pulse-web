import type { IncomingMessage, ServerResponse } from 'http';

import { syncGameStats } from '../src/game-stats-sync.js';
import { getSupabaseClient } from '../src/supabase-client.js';
import { handleJsonRequest } from '../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => syncGameStats(getSupabaseClient()), { allowCors: true });
}
