import type { IncomingMessage, ServerResponse } from 'http';

import { syncGameStats } from '../src/server/sync/index.ts';
import { getSupabaseClient } from '../src/server/supabase/index.ts';
import { gameStatsCacheControl, handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => syncGameStats(getSupabaseClient()), {
    allowCors: true,
    cacheControl: gameStatsCacheControl,
  });
}
