import type { HomeContent, NewsItem } from './home-content.model';

export interface HomeHeroMedia {
  title: string;
  videoUrl: string;
  posterUrl: string;
}

export interface HomeHeroCopy {
  eyebrow: string;
  title: string;
  lede: string;
}

export interface SeasonUpdateSpotlight {
  eyebrow: string;
  title: string;
  description: string;
  sourceUrl: string;
  date: string;
  hasVideo: boolean;
}

export const DEFAULT_HOME_HERO_MEDIA: HomeHeroMedia = {
  title: 'Developer Vision',
  videoUrl: '/videos/home/dev-vision-vol-19.mp4',
  posterUrl: '/images/site/heroes-banner.jpg',
};

const seasonLede = 'Track the live season, its patches, and the heroes shaping the early meta.';

const defaultHeroCopy: HomeHeroCopy = {
  eyebrow: 'Marvel Rivals',
  title: 'Welcome to the latest season.',
  lede: seasonLede,
};

export function buildHomeHeroMedia(content: HomeContent): HomeHeroMedia {
  const seasonUpdate = findSeasonUpdate(content);

  if (!seasonUpdate?.videoUrl) {
    return DEFAULT_HOME_HERO_MEDIA;
  }

  return {
    title: seasonUpdate.videoTitle ?? seasonUpdate.title,
    videoUrl: seasonUpdate.videoUrl,
    posterUrl: seasonUpdate.videoPosterUrl ?? seasonUpdate.thumbnailUrl,
  };
}

export function buildSeasonHeroCopy(content: HomeContent): HomeHeroCopy {
  const currentSeason = findQuickLinkValue(content, 'Current Season');
  const seasonStory = findQuickLinkValue(content, 'Season Story');
  const latestHero = findQuickLinkValue(content, 'Latest Hero');

  if (!currentSeason && !seasonStory) {
    return { ...defaultHeroCopy, lede: buildSeasonLede(latestHero) };
  }

  return {
    eyebrow: ['Marvel Rivals', currentSeason].filter(Boolean).join(' · '),
    title: `Welcome to ${normalizeSentenceFragment(seasonStory ?? 'the latest season')}.`,
    lede: buildSeasonLede(latestHero),
  };
}

export function buildSeasonUpdateSpotlight(
  content: HomeContent,
): SeasonUpdateSpotlight | null {
  const seasonUpdate = findSeasonUpdate(content);

  if (!seasonUpdate) {
    return null;
  }

  return {
    eyebrow: seasonUpdate.videoUrl ? 'Season update spotlight' : 'Latest season update',
    title: seasonUpdate.title,
    description: seasonUpdate.description,
    sourceUrl: seasonUpdate.sourceUrl,
    date: seasonUpdate.publishedAt ?? 'Official Marvel Rivals news',
    hasVideo: Boolean(seasonUpdate.videoUrl),
  };
}

function findSeasonUpdate(content: HomeContent): NewsItem | undefined {
  return content.latestNews.find((item) => item.label === 'Season Update');
}

function findQuickLinkValue(content: HomeContent, label: string): string | undefined {
  return content.quickLinks.find((item) => item.label === label)?.value;
}

/**
 * The lede names the newest hero when the sync knows one, so a season rollover
 * does not leave the previous season's hero named on the home page.
 */
function buildSeasonLede(latestHero: string | undefined): string {
  const heroName = latestHero?.trim();

  return heroName ? `${heroName} has arrived. ${seasonLede}` : seasonLede;
}

function normalizeSentenceFragment(value: string): string {
  return value.trim().replace(/[.?!]+$/u, '');
}