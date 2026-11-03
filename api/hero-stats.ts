import type { IncomingMessage, ServerResponse } from 'http';

import { getHeroStats, heroStatsQueryFrom } from '../src/server/heroes/stats/index.js';
import { getQueryStringValue, handleJsonRequest } from '../src/server/http/index.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);

    return getHeroStats(heroStatsQueryFrom((name) => getQueryStringValue(url.searchParams.get(name) ?? undefined)));
  });
}
