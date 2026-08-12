import type { HomeContent, NewsItem } from './home-content.model';

export interface HomeHeroMedia {
  title: string;
  videoUrl: string;
  posterUrl: string;
}

export interface HomeHeroCopy {
  eyebrow: string;
  title: string;
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

const defaultHeroCopy: HomeHeroCopy = {
  eyebrow: 'Marvel Rivals · Season 9',
  title: 'Welcome to The Mystery of Thebes.',
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

  if (!currentSeason && !seasonStory) {
    return defaultHeroCopy;
  }

  return {
    eyebrow: ['Marvel Rivals', currentSeason].filter(Boolean).join(' · '),
    title: `Welcome to ${normalizeSentenceFragment(seasonStory ?? 'the latest season')}.`,
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

function normalizeSentenceFragment(value: string): string {
  return value.trim().replace(/[.?!]+$/u, '');
}