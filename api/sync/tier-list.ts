import type { IncomingMessage, ServerResponse } from 'http';

import { syncTierList } from '../../src/tier-list-sync.js';
import { sendJson } from '../../src/vercel-api.js';

const noStoreHeaders = {
  'cache-control': 'private, no-store, max-age=0',
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method && req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' }, noStoreHeaders);
    return;
  }

  if (!isAuthorizedSyncRequest(req)) {
    sendJson(res, 401, { error: 'Missing sync authorization' }, noStoreHeaders);
    return;
  }

  try {
    sendJson(res, 200, await syncTierList(), noStoreHeaders);
  } catch (error) {
    console.error('Tier list sync failed', error);
    sendJson(
      res,
      500,
      {
        error: error instanceof Error ? error.message : 'Failed to sync tier list',
      },
      noStoreHeaders,
    );
  }
}

function isAuthorizedSyncRequest(req: IncomingMessage): boolean {
  const syncSecrets = [
    process.env['CRON_SECRET'],
    process.env['SYNC_SECRET'],
  ].filter((value): value is string => Boolean(value));

  if (syncSecrets.length === 0) {
    return isLocalRequest(req);
  }

  return syncSecrets.some(
    (secret) => req.headers.authorization === `Bearer ${secret}`,
  );
}

function isLocalRequest(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';

  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}
