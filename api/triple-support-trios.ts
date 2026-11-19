import type { IncomingMessage, ServerResponse } from 'http';

import { getTripleSupportTrios } from '../src/server/heroes/trios/index.ts';
import { heroStatsQueryFrom } from '../src/server/heroes/stats/index.ts';
import { getQueryStringValue, handleJsonRequest } from '../src/server/http/index.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleJsonRequest(req, res, () => {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);

    return getTripleSupportTrios(heroStatsQueryFrom((name) => getQueryStringValue(url.searchParams.get(name) ?? undefined)));
  });
}
