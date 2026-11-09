import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { handleAccountHttp } from './server/account';
import { handleAdminHttp } from './server/admin';
import {
  getContentStatusFromDatabase,
  getExternalSourceFromDatabase,
  getGlossaryTermsFromDatabase,
  getHeroVideosFromDatabase,
  getHeroesFromDatabase,
  getHomeContentBlocksFromDatabase,
  getHomePortalsFromDatabase,
} from './server/content';
import { getCommunityFigures, getCommunityHeroScores, getCommunityKills } from './server/community/extended';
import { getCommunityInsights } from './server/community/insights';
import { getCommunityMatches } from './server/community/matches';
import { handlePulseRecordsRequest } from './server/records';
import { getHeroMatchups } from './server/heroes/matchups';
import { getHeroPairs, getHeroSynergies } from './server/heroes/pairs';
import { getHeroSwitchIns } from './server/heroes/switch-ins';
import { getTeamLineups } from './server/heroes/lineups';
import { getTripleSupportTrios } from './server/heroes/trios';
import { getHeroStats, getRoleStats, halfSeasonFromQuery, heroStatsQueryFrom } from './server/heroes/stats';
import { syncHomeNews } from './server/content/home';
import { getGameCounts } from './server/game-counts';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.get('/api/content/status', (_req, res) => {
  handleApiResponse(res, () => getContentStatusFromDatabase());
});

/** Reads one query value by name: its string, or undefined when it is missing or repeated. */
const queryReader =
  (query: Record<string, unknown>) =>
  (name: string): string | undefined =>
    typeof query[name] === 'string' ? query[name] : undefined;

app.get('/api/hero-stats', (req, res) => {
  handleApiResponse(res, () => getHeroStats(heroStatsQueryFrom(queryReader(req.query))));
});

app.get('/api/community/matches', (req, res) => {
  const halfSeason = typeof req.query['halfSeason'] === 'string' ? req.query['halfSeason'] : undefined;

  handleApiResponse(res, () => getCommunityMatches({ halfSeason: halfSeasonFromQuery(halfSeason) }));
});

app.get('/api/community/figures', (req, res) => {
  const halfSeason = typeof req.query['halfSeason'] === 'string' ? req.query['halfSeason'] : undefined;

  handleApiResponse(res, () => getCommunityFigures({ halfSeason: halfSeasonFromQuery(halfSeason) }));
});

app.get('/api/community/hero-scores', (req, res) => {
  const halfSeason = typeof req.query['halfSeason'] === 'string' ? req.query['halfSeason'] : undefined;

  handleApiResponse(res, () => getCommunityHeroScores({ halfSeason: halfSeasonFromQuery(halfSeason) }));
});

app.get('/api/community/insights', (_req, res) => {
  handleApiResponse(res, () => getCommunityInsights());
});

app.get('/api/community/kills', (req, res) => {
  const halfSeason = typeof req.query['halfSeason'] === 'string' ? req.query['halfSeason'] : undefined;

  handleApiResponse(res, () => getCommunityKills({ halfSeason: halfSeasonFromQuery(halfSeason) }));
});

app.get('/api/records', (req, res) => {
  void handlePulseRecordsRequest(req, res);
});

app.get('/api/hero-matchups', (_req, res) => {
  handleApiResponse(res, () => getHeroMatchups());
});

app.get('/api/hero-switch-ins', (_req, res) => {
  handleApiResponse(res, () => getHeroSwitchIns());
});

app.get('/api/hero-pairs', (req, res) => {
  handleApiResponse(res, () => getHeroPairs(heroStatsQueryFrom(queryReader(req.query))));
});

app.get('/api/hero-synergies', (req, res) => {
  handleApiResponse(res, () => getHeroSynergies(heroStatsQueryFrom(queryReader(req.query))));
});

app.get('/api/triple-support-trios', (req, res) => {
  handleApiResponse(res, () => getTripleSupportTrios(heroStatsQueryFrom(queryReader(req.query))));
});

app.get('/api/team-lineups', (req, res) => {
  handleApiResponse(res, () => getTeamLineups(heroStatsQueryFrom(queryReader(req.query))));
});

app.get('/api/community/stats', (req, res) => {
  const halfSeason = typeof req.query['halfSeason'] === 'string' ? req.query['halfSeason'] : undefined;

  handleApiResponse(res, () => getRoleStats({ halfSeason: halfSeasonFromQuery(halfSeason) }));
});

app.get('/api/heroes', (_req, res) => {
  handleApiResponse(res, () => getHeroesFromDatabase());
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
  handleApiResponse(res, () => getGameCounts());
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

app.all(['/api/auth/*splat', '/api/account/*splat'], (req, res, next) => {
  handleAccountHttp(req, res, req.path.replace(/^\/api\//, '')).catch(next);
});

app.all('/api/admin/*splat', (req, res, next) => {
  handleAdminHttp(req, res, req.path.replace(/^\/api\//, '')).catch(next);
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

async function handleApiResponse<T>(
  res: express.Response,
  getBody: () => T | Promise<T>,
): Promise<void> {
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
