import type { IncomingMessage, ServerResponse } from 'http';

import { getExternalSourceFromDatabase } from '../../src/server/content/index.js';
import { getQueryStringValue, sendJson } from '../../src/server/http/index.js';

type SourceRequest = IncomingMessage & {
  query?: {
    sourceKey?: string | string[];
  };
};

export default async function handler(req: SourceRequest, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const sourceKey = getQueryStringValue(req.query?.sourceKey);

  if (!sourceKey) {
    sendJson(res, 400, { error: 'Missing source key' });
    return;
  }

  try {
    const source = await getExternalSourceFromDatabase(sourceKey);

    if (!source) {
      sendJson(res, 404, { error: 'External source not found' });
      return;
    }

    sendJson(res, 200, source);
  } catch (error) {
    console.error('Vercel external source API failed', error);
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'Failed to load content data' });
  }
}
