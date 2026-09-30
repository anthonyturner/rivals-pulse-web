import type { SeasonHighlight, SeasonUpdate } from './home-season.model.js';

export interface HomeStat {
  value: string;
  label: string;
}

export interface PortalCard {
  title: string;
  description: string;
  path: string;
  image: string;
}

export interface NewsItem {
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
}

export interface GuideSpotlight {
  title: string;
  description: string;
  path: string;
  tag: string;
}

export interface QuickLink {
  label: string;
  value: string;
  imageUrl?: string;
}

export interface SeasonDashboardSection {
  eyebrow: string;
  title: string;
  description: string;
}

export interface SeasonDashboardLinkedSection extends SeasonDashboardSection {
  sourceLabel: string;
  sourceUrl: string;
}

export interface SeasonDashboardContent {
  heroUsage: SeasonDashboardSection;
  officialUpdates: SeasonDashboardSection;
  events: SeasonDashboardLinkedSection;
}

export interface SeasonGlanceContent {
  ariaLabel: string;
  status: {
    label: string;
    value: string;
  };
  latestHero: {
    label: string;
    name: string;
    detail: string;
    imageUrl: string;
  };
  tuning: {
    label: string;
    sourceLabel: string;
  };
}

export interface HomeContent {
  heroStats: HomeStat[];
  portals: PortalCard[];
  latestNews: NewsItem[];
  featuredGuides: GuideSpotlight[];
  quickLinks: QuickLink[];
  currentFocusTitle: string;
  currentFocusDescription: string;
  lastChecked: string;
  seasonUpdates: SeasonUpdate[];
  latestTuning: SeasonUpdate | null;
  seasonEvents: SeasonHighlight[];
  seasonEventsSourceUrl: string;
  seasonDashboard: SeasonDashboardContent | null;
  seasonGlance: SeasonGlanceContent | null;
  sourceMode: 'database' | 'fallback';
}
