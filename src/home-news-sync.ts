import { createClient } from '@tursodatabase/serverless/compat';

import { StringUtility } from './app/shared/utilities/string-utility.js';

export type NewsItem = {
  label: string;
  title: string;
  description: string;
  sourceUrl: string;
  thumbnailUrl: string;
  thumbnailAlt: string;
  publishedAt?: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  videoTitle?: string;
};

type SeasonUpdate = {
  category: string;
  date: string;
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  videoTitle?: string;
};

type SeasonHighlight = {
  label: string;
  title: string;
  description: string;
};

type DashboardSection = {
  eyebrow: string;
  title: string;
  description: string;
};

type SeasonDashboardContent = {
  heroUsage: DashboardSection;
  officialUpdates: DashboardSection;
  events: DashboardSection & { sourceLabel: string; sourceUrl: string };
};

type SeasonGlanceContent = {
  ariaLabel: string;
  status: { label: string; value: string };
  latestHero: { label: string; name: string; detail: string; imageUrl: string };
  tuning: { label: string; sourceLabel: string };
};

type QuickLink = {
  label: string;
  value: string;
  imageUrl?: string;
};

type BattlePassSnapshot = {
  currentSeason: string;
  battlePass: string;
  seasonStory?: string;
  latestHero?: string;
  latestHeroImageUrl?: string;
};

export type HomeNewsSyncResult = {
  updatedAt: string;
  latestNews: NewsItem[];
  battlePass: BattlePassSnapshot;
  officialItemsRead: number;
  seasonUpdates: SeasonUpdate[];
  latestTuning?: SeasonUpdate;
  seasonEvents: SeasonHighlight[];
};

const officialHomeSource = {
  key: 'official-marvel-rivals-home',
  name: 'Official Marvel Rivals Home',
  url: 'https://www.marvelrivals.com/index.html',
};

const fallbackBattlePassSnapshot: BattlePassSnapshot = {
  currentSeason: 'Season 9',
  battlePass: 'The Mystery of Thebes',
  seasonStory: 'The Mystery of Thebes',
  latestHero: 'Jubilee',
  latestHeroImageUrl: '/images/heroes/jubilee.png',
};
const fallbackThumbnail = '/images/site/heroes-banner.jpg';
const {
  cleanText,
  extractByClass,
  formatList,
  parseAttributes,
  truncate,
} = StringUtility;
const absoluteUrl = (value: string) => StringUtility.absoluteUrl(value, officialHomeSource.url);
const firstImage = (html: string) => StringUtility.firstImage(html, officialHomeSource.url);
const titleCaseName = StringUtility.titleCase;
const slugifyHeroName = StringUtility.heroSlug;

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

try {
  nodeProcess.loadEnvFile?.('.env');
} catch {
  // Vercel and CI provide environment variables directly.
}

export async function syncHomeNews(): Promise<HomeNewsSyncResult> {
  const db = createClient({
    url: requireEnv('TURSO_DATABASE_URL'),
    authToken: requireEnv('TURSO_AUTH_TOKEN'),
  });
  const startedAt = new Date().toISOString();
  const runId = await insertSyncRun(db, 'home-news', startedAt);

  try {
    const officialHomeHtml = await fetchText(officialHomeSource.url);
    const fetchedAt = new Date().toISOString();
    const officialSnapshot = parseOfficialHomeSnapshot(officialHomeHtml);
    const battlePassSnapshot = officialSnapshot.battlePass;
    const latestTuning = officialSnapshot.news
      .find((item) => item.label === 'Balance Update');
    const latestPatch = officialSnapshot.news
      .find((item) => item.label === 'Patch Notes');
    const latestSeasonUpdate = officialSnapshot.news
      .find((item) => item.label === 'Season Update');
    const latestPatchHtml = latestPatch ? await fetchText(latestPatch.sourceUrl) : undefined;
    const latestSeasonUpdateHtml = latestSeasonUpdate
      ? await fetchOptionalText(latestSeasonUpdate.sourceUrl)
      : undefined;
    const seasonUpdateVideo = latestSeasonUpdateHtml
      ? extractArticleVideo(latestSeasonUpdateHtml)
      : undefined;
    const enrichedNews = officialSnapshot.news.map((item) => (
      item.sourceUrl === latestPatch?.sourceUrl && latestPatchHtml
        ? {
            ...item,
            description: buildPatchDescription(item.description, latestPatchHtml),
          }
        : item.sourceUrl === latestSeasonUpdate?.sourceUrl && seasonUpdateVideo
          ? { ...item, ...seasonUpdateVideo }
          : item
    ));
    const latestNews = buildLatestNewsCards(enrichedNews);
    const seasonUpdates = enrichedNews.slice(0, 3).map(toSeasonUpdate);
    const seasonEvents = latestPatchHtml ? parseSeasonEvents(latestPatchHtml) : [];
    const seasonDashboard = buildSeasonDashboardContent(
      battlePassSnapshot,
      latestPatch?.sourceUrl ?? officialHomeSource.url,
      fetchedAt,
    );
    const seasonGlance = buildSeasonGlanceContent(battlePassSnapshot);

    await Promise.all([
      upsertExternalSource(db, officialHomeSource, officialSnapshot, fetchedAt, 'success', null),
      upsertContentBlock(db, 'latestNews', latestNews, fetchedAt),
      upsertContentBlock(db, 'quickLinks', await buildQuickLinks(db, battlePassSnapshot), fetchedAt),
      upsertContentBlock(db, 'currentFocusTitle', focusTitle(latestNews), fetchedAt),
      upsertContentBlock(db, 'currentFocusDescription', focusDescription(latestNews), fetchedAt),
      upsertContentBlock(db, 'lastChecked', fetchedAt.slice(0, 10), fetchedAt),
      upsertContentBlock(db, 'seasonUpdates', seasonUpdates, fetchedAt),
      upsertContentBlock(db, 'latestTuning', latestTuning ? toSeasonUpdate(latestTuning) : null, fetchedAt),
      upsertContentBlock(db, 'seasonEvents', seasonEvents, fetchedAt),
      upsertContentBlock(db, 'seasonEventsSourceUrl', latestPatch?.sourceUrl ?? officialHomeSource.url, fetchedAt),
      upsertContentBlock(db, 'seasonDashboard', seasonDashboard, fetchedAt),
      upsertContentBlock(db, 'seasonGlance', seasonGlance, fetchedAt),
    ]);

    await finishSyncRun(db, runId, 'success', `Synced ${latestNews.length} home news cards`, fetchedAt);

    return {
      updatedAt: fetchedAt,
      latestNews,
      battlePass: battlePassSnapshot,
      officialItemsRead: officialSnapshot.news.length,
      seasonUpdates,
      latestTuning: latestTuning ? toSeasonUpdate(latestTuning) : undefined,
      seasonEvents,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);

    await finishSyncRun(db, runId, 'error', message, finishedAt);
    throw error;
  } finally {
    db.close();
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'rivals-pulse-content-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchOptionalText(url: string): Promise<string | undefined> {
  try {
    return await fetchText(url);
  } catch {
    return undefined;
  }
}

function buildLatestNewsCards(officialNews: NewsItem[]): NewsItem[] {
  return officialNews.slice(0, 4);
}

export function buildPatchDescription(teaser: string, html: string): string {
  const beforeFixes = html.split(/<h2[^>]*>\s*Fixes and Optimizations\s*<\/h2>/i)[0];
  const additions = Array.from(beforeFixes.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi))
    .map((match) => describePatchAddition(cleanText(match[1])))
    .filter((value): value is string => Boolean(value));
  const uniqueAdditions = [...new Set(additions)].slice(0, 5);
  const fixesHtml = html.slice(beforeFixes.length);
  const fixAreas = Array.from(fixesHtml.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi))
    .map((match) => cleanText(match[1]))
    .filter((heading) => /^(Heroes|System|Console|PC|All Platforms|Maps and Modes)$/i.test(heading))
    .map(normalizeFixArea);
  const details = [
    uniqueAdditions.length ? `It includes ${formatList(uniqueAdditions)}` : '',
    fixAreas.length ? `${formatList([...new Set(fixAreas)])} fixes` : '',
  ].filter(Boolean);

  return details.length ? truncate(`${teaser} ${details.join(', plus ')}.`, 420) : teaser;
}

function normalizeFixArea(heading: string): string {
  const normalized: Record<string, string> = {
    heroes: 'hero',
    'all platforms': 'all-platform',
    'maps and modes': 'map and mode',
  };

  return normalized[heading.toLowerCase()] ?? heading.toLowerCase();
}

function describePatchAddition(heading: string): string | undefined {
  if (/^New In Store$/i.test(heading)) return 'new store bundles and cosmetics';
  if (/^New Event:\s*/i.test(heading)) return heading.replace(/^New Event:\s*/i, '');
  if (/Battle Pass/i.test(heading)) return `the ${heading}`;
  if (/Event|Chrono-Rush|POP & WIN|Twitch Drops|Rank Rewards/i.test(heading)) return heading;
  return undefined;
}

function buildSeasonDashboardContent(
  battlePass: BattlePassSnapshot,
  eventsSourceUrl: string,
  fetchedAt: string,
): SeasonDashboardContent {
  const checkedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(fetchedAt));

  return {
    heroUsage: {
      eyebrow: `${battlePass.currentSeason} meta`,
      title: 'Most-used heroes',
      description:
        'All-ranks pick rate, with mirror matches excluded from win-rate calculations.',
    },
    officialUpdates: {
      eyebrow: 'Official updates',
      title: 'Latest news and patch notes',
      description:
        `The most relevant announcements for the current season, newest first. Official site checked ${checkedDate}.`,
    },
    events: {
      eyebrow: 'In season now',
      title: 'Events and rewards',
      description:
        `Current objectives and unlocks from the latest official patch notes. Official site checked ${checkedDate}.`,
      sourceLabel: 'Official patch notes',
      sourceUrl: eventsSourceUrl,
    },
  };
}

function buildSeasonGlanceContent(battlePass: BattlePassSnapshot): SeasonGlanceContent {
  const latestHero = battlePass.latestHero ?? '';

  return {
    ariaLabel: `${battlePass.currentSeason} at a glance`,
    status: {
      label: 'Season status',
      value: 'Live now',
    },
    latestHero: {
      label: 'Newest hero',
      name: latestHero,
      detail: `${battlePass.currentSeason} latest release`,
      imageUrl: battlePass.latestHeroImageUrl ?? '',
    },
    tuning: {
      label: 'Latest tuning',
      sourceLabel: 'Official balance post',
    },
  };
}

async function buildQuickLinks(
  db: ReturnType<typeof createClient>,
  battlePass: BattlePassSnapshot,
): Promise<QuickLink[]> {
  const existing = await getContentBlock<QuickLink[]>(db, 'quickLinks');
  const quickLinks = existing?.length
    ? existing
    : [
        { label: 'Current Season', value: battlePass.currentSeason },
        { label: 'Season Story', value: battlePass.seasonStory ?? battlePass.battlePass },
        {
          label: 'Latest Hero',
          value: battlePass.latestHero ?? 'Jubilee',
          imageUrl: battlePass.latestHeroImageUrl,
        },
      ];
  const normalizedLinks = [
    { label: 'Current Season', value: battlePass.currentSeason },
    { label: 'Season Story', value: battlePass.seasonStory ?? battlePass.battlePass },
    {
      label: 'Latest Hero',
      value: battlePass.latestHero ?? 'Jubilee',
      imageUrl: battlePass.latestHeroImageUrl,
    },
    ...quickLinks.filter((item) =>
      !['Current Season', 'Mid-Season', 'BattlePass', 'Season Story', 'Latest Hero', 'Latest Reported Hero'].includes(item.label),
    ),
  ];

  return normalizedLinks.map((item) => {
    if (item.label === 'Current Season') {
      return { ...item, value: battlePass.currentSeason };
    }

    if (item.label === 'BattlePass') {
      return { ...item, value: battlePass.battlePass };
    }

    if (item.label === 'Season Story') {
      return { ...item, value: battlePass.seasonStory ?? battlePass.battlePass };
    }

    if (item.label === 'Latest Hero' || item.label === 'Latest Reported Hero') {
      return {
        ...item,
        label: 'Latest Hero',
        value: battlePass.latestHero ?? 'Jubilee',
        imageUrl: battlePass.latestHeroImageUrl,
      };
    }

    return item;
  });
}

function parseOfficialHomeSnapshot(html: string): { news: NewsItem[]; battlePass: BattlePassSnapshot } {
  const news = parseOfficialNewsCards(html);
  const seasonNews = news.find((item) => /Season\s+\d+/i.test(item.title));
  const seasonTitle = seasonNews?.title.match(/(Season\s+\d+(?:\.\d+)?)(?::\s*([^/]+?))?(?:\s*\/\/|$)/i);
  const currentSeason = seasonTitle?.[1]?.trim() ?? fallbackBattlePassSnapshot.currentSeason;
  const seasonStory = seasonTitle?.[2]?.trim() ?? fallbackBattlePassSnapshot.seasonStory;
  const latestHero = parseLatestOfficialHero(html);

  return {
    news,
    battlePass: {
      currentSeason,
      battlePass: seasonStory ?? currentSeason,
      seasonStory,
      latestHero: latestHero?.name ?? fallbackBattlePassSnapshot.latestHero,
      latestHeroImageUrl: latestHero?.imageUrl ?? fallbackBattlePassSnapshot.latestHeroImageUrl,
    },
  };
}

export function parseOfficialNewsCards(html: string): NewsItem[] {
  const newsRegion = html.match(/<div class="newsCms"[^>]*>([\s\S]*?)<div class="news-tab">/i)?.[1]
    ?? html.match(/<div class="banner">([\s\S]*?)<\/div>\s*<div class="list">/i)?.[1]
    ?? '';
  const cards: NewsItem[] = [];
  const seenTitles = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(newsRegion))) {
    const attrs = parseAttributes(match[1]);
    const body = match[2];
    const title = cleanText(extractByClass(body, 'title') || extractByClass(body, 'til'));
    const description = cleanText(extractByClass(body, 'desc'));

    if (!title || seenTitles.has(title)) {
      continue;
    }

    seenTitles.add(title);

    cards.push({
      label: labelForOfficialNews(title),
      title,
      description: description || 'Read the latest official Marvel Rivals announcement.',
      sourceUrl: absoluteUrl(attrs['href'] ?? officialHomeSource.url),
      thumbnailUrl: firstImage(body) ?? fallbackThumbnail,
      thumbnailAlt: `${title} thumbnail`,
      publishedAt: cleanText(
        extractByClass(body, 'date') || extractByClass(body, 'time'),
      ) || undefined,
    });
  }

  return cards.length > 0 ? cards : [{
    label: 'Season Update',
    title: 'Season 9: The Mystery of Thebes',
    description: 'Official Marvel Rivals Season 9 coverage is available on the Marvel Rivals site.',
    sourceUrl: officialHomeSource.url,
    thumbnailUrl: fallbackThumbnail,
    thumbnailAlt: 'Marvel Rivals Season 9 thumbnail',
  }];
}

export function parseSeasonEvents(html: string): SeasonHighlight[] {
  const article = html.match(/<div[^>]*class="[^"]*artText[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1]
    ?? html;
  const content = article.split(/<h2[^>]*>\s*Fixes and Optimizations\s*<\/h2>/i)[0];
  const candidates: Array<SeasonHighlight & { score: number; order: number }> = [];
  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h[23]\b|$)/gi;
  let match: RegExpExecArray | null;
  let order = 0;

  while ((match = sectionPattern.exec(content))) {
    const title = cleanText(match[1]).replace(/^New Event:\s*/i, '');
    const fullDescription = cleanText(match[2]);
    const description = truncate(fullDescription, 240);
    const searchable = `${title} ${fullDescription}`.toLowerCase();
    const score = eventScore(searchable);

    if (!title || !description || score === 0) {
      continue;
    }

    candidates.push({
      label: eventLabel(searchable),
      title,
      description,
      score,
      order: order++,
    });
  }

  return candidates
    .sort((first, second) => second.score - first.score || first.order - second.order)
    .slice(0, 3)
    .map(({ label, title, description }) => ({ label, title, description }));
}

function extractArticleVideo(
  html: string,
): Pick<NewsItem, 'videoUrl' | 'videoPosterUrl' | 'videoTitle'> | undefined {
  const match = html.match(/<div[^>]*class="[^"]*video_ctn[^"]*"([^>]*)>/i);

  if (!match) {
    return undefined;
  }

  const attrs = parseAttributes(match[1]);
  const videoUrl = attrs['data-hdmovieurl'] ?? attrs['data-movieurl'];

  if (!videoUrl) {
    return undefined;
  }

  return {
    videoUrl: absoluteUrl(videoUrl),
    videoPosterUrl: absoluteUrl(attrs['data-startimg'] ?? fallbackThumbnail),
    videoTitle: cleanText(attrs['data-name']) || undefined,
  };
}

function eventScore(value: string): number {
  if (/new event|event missions|event period|during the event|chrono-rush/.test(value)) return 100;
  if (/battle pass/.test(value)) return 90;
  if (
    /twitch drops|rank rewards|free rewards|exclusive rewards|unlock an exclusive|earn \d+ units/.test(
      value,
    )
  ) {
    return 80;
  }
  if (/pop & win|limited.time|limited time/.test(value)) return 60;
  return 0;
}

function eventLabel(value: string): string {
  if (value.includes('battle pass')) return 'Battle Pass';
  if (value.includes('twitch drops')) return 'Twitch Drops';
  if (value.includes('rank reward')) return 'Rank reward';
  if (/unlock an exclusive|earn \d+ units/.test(value)) return 'Event rewards';
  return 'Limited-time event';
}

function toSeasonUpdate(item: NewsItem): SeasonUpdate {
  return {
    category: item.label,
    date: formatOfficialDate(item.publishedAt),
    title: item.title,
    description: item.description,
    sourceUrl: item.sourceUrl,
    videoUrl: item.videoUrl,
    videoPosterUrl: item.videoPosterUrl,
    videoTitle: item.videoTitle,
  };
}

function formatOfficialDate(value: string | undefined): string {
  const match = value?.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);

  if (!match) return value ?? 'Recently';

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`));
}

function parseLatestOfficialHero(html: string): { name: string; imageUrl?: string } | undefined {
  const heroMatch = html.match(/<div class="heroNewsList">\s*<a\b([^>]*)>([\s\S]*?)<\/a>/i);

  if (!heroMatch) {
    return undefined;
  }

  const attrs = parseAttributes(heroMatch[1]);
  const name = titleCaseName(attrs['data-name'] ?? attrs['title']);

  return {
    name,
    imageUrl: firstImage(heroMatch[2]) ?? `/images/heroes/${slugifyHeroName(name)}.png`,
  };
}

function labelForOfficialNews(title: string): string {
  const text = title.toLowerCase();

  if (text.includes('balance')) {
    return 'Balance Update';
  }

  if (text.includes('patch') || text.includes('version')) {
    return 'Patch Notes';
  }

  if (text.includes('season')) {
    return 'Season Update';
  }

  return 'Official News';
}

function focusTitle(newsItems: NewsItem[]): string {
  return newsItems.find((item) => item.label !== 'Battle Pass')?.title ?? 'Latest Marvel Rivals News';
}

function focusDescription(newsItems: NewsItem[]): string {
  const lead = newsItems.find((item) => item.label !== 'Battle Pass');

  return lead?.description ?? 'Latest news is refreshed from the official Marvel Rivals site and cached in Turso.';
}

async function getContentBlock<T>(
  db: ReturnType<typeof createClient>,
  contentKey: string,
): Promise<T | undefined> {
  const result = await db.execute(
    'SELECT payload_json FROM home_content_blocks WHERE content_key = ?',
    [contentKey],
  );
  const row = result.rows[0] as { payload_json?: string } | undefined;

  return row?.payload_json ? JSON.parse(row.payload_json) as T : undefined;
}

async function upsertContentBlock(
  db: ReturnType<typeof createClient>,
  contentKey: string,
  payload: unknown,
  updatedAt: string,
): Promise<void> {
  await db.execute(
    `INSERT INTO home_content_blocks (content_key, payload_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(content_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at`,
    [contentKey, JSON.stringify(payload), updatedAt],
  );
}

async function upsertExternalSource(
  db: ReturnType<typeof createClient>,
  source: { key: string; name: string; url: string },
  payload: unknown,
  fetchedAt: string,
  status: string,
  error: string | null,
): Promise<void> {
  await db.execute(
    `INSERT INTO external_sources (
      source_key, source_name, url, payload_json, fetched_at, status, error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      source_name = excluded.source_name,
      url = excluded.url,
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at,
      status = excluded.status,
      error = excluded.error`,
    [source.key, source.name, source.url, JSON.stringify(payload), fetchedAt, status, error],
  );
}

async function insertSyncRun(
  db: ReturnType<typeof createClient>,
  sourceKey: string,
  startedAt: string,
): Promise<number> {
  const result = await db.execute(
    `INSERT INTO sync_runs (source_key, status, message, started_at)
    VALUES (?, ?, ?, ?)`,
    [sourceKey, 'running', 'Refreshing home news content', startedAt],
  );

  return Number(result.lastInsertRowid);
}

async function finishSyncRun(
  db: ReturnType<typeof createClient>,
  runId: number,
  status: string,
  message: string,
  finishedAt: string,
): Promise<void> {
  await db.execute(
    `UPDATE sync_runs
    SET status = ?, message = ?, finished_at = ?
    WHERE id = ?`,
    [status, message, finishedAt, runId],
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Set ${name} before syncing home news.`);
  }

  return value;
}
