import type { HomeContent } from './home-content.model';

/** Fixtures the home page specs share; nothing imports this outside a spec. */
export const emptyHomeContent: HomeContent = {
  heroStats: [],
  portals: [],
  latestNews: [],
  featuredGuides: [],
  quickLinks: [],
  currentFocusTitle: '',
  currentFocusDescription: '',
  lastChecked: '2026-10-30',
  seasonUpdates: [],
  latestTuning: null,
  seasonEvents: [],
  seasonEventsSourceUrl: '',
  seasonDashboard: null,
  seasonGlance: null,
  sourceMode: 'database',
};

/** Official-site content with every news block filled and a season update that carries a video. */
export const fullHomeContent: HomeContent = {
  ...emptyHomeContent,
  latestNews: [
    {
      label: 'Season Update',
      title: 'Step into Season 10 // Dev Vision Vol. 21',
      description: 'The latest season reveal, with a new hero and a battle pass.',
      sourceUrl: 'https://example.com/season',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      thumbnailAlt: 'Season 10 thumbnail',
      publishedAt: 'October 9, 2026',
      videoUrl: '/videos/home/season-update.mp4',
      videoPosterUrl: 'https://example.com/poster.jpg',
      videoTitle: 'Dev Vision Vol. 21',
    },
  ],
  seasonUpdates: [1, 2, 3, 4].map((index) => ({
    category: 'Patch Notes',
    date: `Oct ${index}`,
    title: `Update ${index}`,
    description: `Update ${index} description`,
    sourceUrl: `https://example.com/update-${index}`,
  })),
  latestTuning: {
    category: 'Balance',
    date: 'Oct 24',
    title: 'Balance post',
    description: 'Tuning notes',
    sourceUrl: 'https://example.com/tuning',
  },
  seasonEvents: [1, 2, 3, 4].map((index) => ({
    label: `Event ${index}`,
    title: `Event title ${index}`,
    description: `Event ${index} description`,
  })),
  seasonDashboard: {
    officialUpdates: { eyebrow: 'Official updates', title: 'Latest news and patch notes', description: 'x' },
    events: {
      eyebrow: 'In season now',
      title: 'Events and rewards',
      description: 'x',
      sourceLabel: 'Official patch notes',
      sourceUrl: 'https://example.com/patch',
    },
  },
  seasonGlance: {
    ariaLabel: 'Season 10 at a glance',
    status: { label: 'Season status', value: 'Live now' },
    latestHero: {
      label: 'Newest hero',
      name: 'Gorr The God Butcher',
      detail: 'Season 10 latest release',
      imageUrl: '/images/heroes/gorr.png',
    },
    tuning: { label: 'Latest tuning', sourceLabel: 'Official balance post' },
  },
};
