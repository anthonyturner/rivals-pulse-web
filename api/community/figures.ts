import type { IncomingMessage, ServerResponse } from 'http';

import { getCommunityFigures } from '../../src/community-extended-read.js';
import { halfSeasonFromQuery } from '../../src/hero-stats-read.js';
import { getQueryStringValue, handleJsonRequest } from '../../src/vercel-api.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    const halfSeason = halfSeasonFromQuery(getQueryStringValue(url.searchParams.get('halfSeason') ?? undefined));

    return getCommunityFigures({ halfSeason });
  });
}
