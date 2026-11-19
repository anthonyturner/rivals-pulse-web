import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityMatches } from '../../src/server/community/matches/index.ts';
import { halfSeasonFromQuery } from '../../src/server/heroes/stats/index.ts';
import { getQueryStringValue, handleJsonRequest } from '../../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    const halfSeason = halfSeasonFromQuery(getQueryStringValue(url.searchParams.get('halfSeason') ?? undefined));

    return getCommunityMatches({ halfSeason });
  });
}
