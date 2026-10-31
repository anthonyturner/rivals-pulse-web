import type { HomeContent, NewsItem } from './home-content.model';

export interface HomeHeroMedia {
  title: string;
  videoUrl: string;
  posterUrl: string;
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
