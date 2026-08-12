import type { IncomingMessage, ServerResponse } from 'http';

import {
  getContentStatusFromDatabase,
  getExternalSourceFromDatabase,
  getGlossaryTermsFromDatabase,
  getHeroFromDatabase,
  getHeroVideosFromDatabase,
  getHeroesFromDatabase,
  getHomeContentBlocksFromDatabase,
  getHomePortalsFromDatabase,
  getTierListFromDatabase,
} from '../src/content-database.js';
import gameStatsHandler from './game-stats.js';
import gameStatsSyncHandler from './sync/game-stats.js';
import homeNewsSyncHandler from './sync/home-news.js';
import tierListSyncHandler from './sync/tier-list.js';

type VercelRequest = IncomingMessage & {
  query?: {
    path?: string | string[];
  };
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 's-maxage=300, stale-while-revalidate=3600',
};
const noStoreJsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store, max-age=0',
};

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const route = getApiRoute(req);

  try {
    if (route === 'content/status') {
      sendJson(res, 200, await getContentStatusFromDatabase());
      return;
    }

    if (route === 'game-stats') {
      await gameStatsHandler(req, res);
      return;
    }

    if (route === 'sync/game-stats') {
      await gameStatsSyncHandler(req, res);
      return;
    }

    if (route === 'sync/home-news') {
      await homeNewsSyncHandler(req, res);
      return;
    }

    if (route === 'sync/tier-list') {
      await tierListSyncHandler(req, res);
      return;
    }

    if (route === 'tier-list') {
      const url = new URL(req.url ?? '/', 'https://local.invalid');
      const season = url.searchParams.get('season');
      const rank = url.searchParams.get('rank') ?? '5+';
      const seasonId = season ? Number(season) : undefined;

      sendJson(res, 200, await getTierListFromDatabase(Number.isFinite(seasonId) ? seasonId : undefined, rank) ?? null);
      return;
    }

    if (route === 'heroes') {
      sendJson(res, 200, await getHeroesFromDatabase());
      return;
    }

    if (route.startsWith('heroes/')) {
      const heroId = decodeURIComponent(route.slice('heroes/'.length));
      const hero = await getHeroFromDatabase(heroId);
      sendJson(res, hero ? 200 : 404, hero ?? { error: 'Hero not found' });
      return;
    }

    if (route === 'hero-videos') {
      sendJson(res, 200, await getHeroVideosFromDatabase());
      return;
    }

    if (route === 'home/portals') {
      sendJson(res, 200, await getHomePortalsFromDatabase());
      return;
    }

    if (route === 'home/content') {
      sendJson(res, 200, await getHomeContentBlocksFromDatabase(), noStoreJsonHeaders);
      return;
    }

    if (route === 'glossary') {
      sendJson(res, 200, await getGlossaryTermsFromDatabase());
      return;
    }

    if (route.startsWith('external-sources/')) {
      const sourceKey = decodeURIComponent(route.slice('external-sources/'.length));
      const source = await getExternalSourceFromDatabase(sourceKey);
      sendJson(res, source ? 200 : 404, source ?? { error: 'External source not found' });
      return;
    }

    sendJson(res, 404, { error: 'API route not found' });
  } catch (error) {
    console.error(`Vercel API failed for /api/${route}`, error);
    sendJson(res, 500, { error: 'Failed to load content data' });
  }
}

function getApiRoute(req: VercelRequest): string {
  const queryPath = normalizePath(req.query?.path);

  if (queryPath) {
    return queryPath;
  }

  const pathname = new URL(req.url ?? '/', 'https://local.invalid').pathname;

  return pathname
    .replace(/^\/api\/?/, '')
    .replace(/^\/+|\/+$/g, '');
}

function normalizePath(path: string | string[] | undefined): string {
  if (!path) {
    return '';
  }

  return Array.isArray(path) ? path.join('/') : path;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers = jsonHeaders,
): void {
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(body));
}
