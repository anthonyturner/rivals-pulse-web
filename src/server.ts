import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

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
} from './content-database';
import { syncHomeNews } from './home-news-sync';
import { syncGameStats } from './game-stats-sync';
import { syncTierList } from './tier-list-sync';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.get('/api/content/status', (_req, res) => {
  handleApiResponse(res, () => getContentStatusFromDatabase());
});

app.get('/api/heroes', (_req, res) => {
  handleApiResponse(res, () => getHeroesFromDatabase());
});

app.get('/api/heroes/:id', (req, res) => {
  handleApiResponse(res, () => {
    const hero = getHeroFromDatabase(req.params.id);

    if (!hero) {
      res.status(404);

      return { message: `Hero not found: ${req.params.id}` };
    }

    return hero;
  });
});

app.get('/api/hero-videos', (_req, res) => {
  handleApiResponse(res, () => getHeroVideosFromDatabase());
});

app.get('/api/home/portals', (_req, res) => {
  handleApiResponse(res, () => getHomePortalsFromDatabase());
});

app.get('/api/home/content', (_req, res) => {
  handleApiResponse(res, () => getHomeContentBlocksFromDatabase());
});

app.get('/api/sync/home-news', (req, res) => {
  if (!isAuthorizedSyncRequest(req)) {
    res.status(401).json({ message: 'Missing sync authorization' });
    return;
  }

  handleApiResponse(res, () => syncHomeNews());
});

app.get('/api/glossary', (_req, res) => {
  handleApiResponse(res, () => getGlossaryTermsFromDatabase());
});

app.get('/api/game-stats', (_req, res) => {
  handleApiResponse(res, () => syncGameStats());
});

app.get('/api/sync/game-stats', (req, res) => {
  if (!isAuthorizedSyncRequest(req)) {
    res.status(401).json({ message: 'Missing sync authorization' });
    return;
  }

  handleApiResponse(res, () => syncGameStats());
});

app.get('/api/tier-list', (req, res) => {
  handleApiResponse(res, () => {
    const season = typeof req.query['season'] === 'string' ? Number(req.query['season']) : undefined;
    const rank = typeof req.query['rank'] === 'string' ? req.query['rank'] : '5+';

    return getTierListFromDatabase(Number.isFinite(season) ? season : undefined, rank);
  });
});

app.get('/api/sync/tier-list', (req, res) => {
  if (!isAuthorizedSyncRequest(req)) {
    res.status(401).json({ message: 'Missing sync authorization' });
    return;
  }

  handleApiResponse(res, () => syncTierList());
});

app.get('/api/external-sources/:sourceKey', (req, res) => {
  handleApiResponse(res, () => {
    const source = getExternalSourceFromDatabase(req.params.sourceKey);

    if (!source) {
      res.status(404);

      return { message: `External source not found: ${req.params.sourceKey}` };
    }

    return source;
  });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

async function handleApiResponse(res: express.Response, getBody: () => unknown | Promise<unknown>): Promise<void> {
  try {
    res.json(await getBody());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected API error';

    res.status(500).json({ message });
  }
}

function isAuthorizedSyncRequest(req: express.Request): boolean {
  const syncSecrets = [
    process.env['CRON_SECRET'],
    process.env['SYNC_SECRET'],
  ].filter((value): value is string => Boolean(value));

  if (syncSecrets.length === 0) {
    return req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  }

  return syncSecrets.some(
    (secret) => req.headers.authorization === `Bearer ${secret}`,
  );
}
