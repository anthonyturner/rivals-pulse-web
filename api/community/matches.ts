import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityMatches } from '../../src/server/community/matches/community-matches-read.js';
import { halfSeasonFromQuery } from '../../src/server/heroes/stats/hero-stats-read.js';
import { getQueryStringValue, handleJsonRequest } from '../../src/server/http/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    const halfSeason = halfSeasonFromQuery(getQueryStringValue(url.searchParams.get('halfSeason') ?? undefined));

    return getCommunityMatches({ halfSeason });
  });
}
