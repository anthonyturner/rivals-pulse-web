import type { HomeContent } from './home-content.model';
import {
  buildHomeHeroMedia,
  buildSeasonHeroCopy,
  buildSeasonUpdateSpotlight,
  DEFAULT_HOME_HERO_MEDIA,
} from './home-page-hero.utils';

describe('homePageHeroUtils', () => {
  const baseContent: HomeContent = {
    heroStats: [],
    portals: [],
    latestNews: [],
    featuredGuides: [],
    quickLinks: [
      { label: 'Current Season', value: 'Season 9.5' },
      { label: 'Season Story', value: 'The Mystery of Thebes' },
    ],
    currentFocusTitle: '',
    currentFocusDescription: '',
    lastChecked: '2026-08-05',
    seasonUpdates: [],
    latestTuning: null,
    seasonEvents: [],
    seasonEventsSourceUrl: '',
    seasonDashboard: null,
    seasonGlance: null,
    sourceMode: 'database',
  };

  it('prefers the latest season update video for hero media', () => {
    const media = buildHomeHeroMedia({
      ...baseContent,
      latestNews: [
        {
          label: 'Season Update',
          title: 'Step into Season 9.5 // Dev Vision Vol. 20',
          description: 'Latest season reveal.',
          sourceUrl: 'https://example.com/season',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          thumbnailAlt: 'Season 9.5 thumbnail',
          videoUrl: 'https://example.com/season-video.mp4',
          videoPosterUrl: 'https://example.com/poster.jpg',
          videoTitle: 'Dev Vision Vol. 20',
        },
      ],
    });

    expect(media).toEqual({
      title: 'Dev Vision Vol. 20',
      videoUrl: 'https://example.com/season-video.mp4',
      posterUrl: 'https://example.com/poster.jpg',
    });
  });

  it('falls back to the default hero media when no season update video exists', () => {
    expect(
      buildHomeHeroMedia({
        ...baseContent,
        latestNews: [
          {
            label: 'Season Update',
            title: 'Step into Season 9.5',
            description: 'Latest season reveal.',
            sourceUrl: 'https://example.com/season',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            thumbnailAlt: 'Season 9.5 thumbnail',
          },
        ],
      }),
    ).toEqual(DEFAULT_HOME_HERO_MEDIA);
  });

  it('builds the hero copy from season quick links', () => {
    expect(buildSeasonHeroCopy(baseContent)).toEqual({
      eyebrow: 'Marvel Rivals · Season 9.5',
      title: 'Welcome to The Mystery of Thebes.',
    });
  });

  it('exposes a spotlight card for the latest season update', () => {
    expect(
      buildSeasonUpdateSpotlight({
        ...baseContent,
        latestNews: [
          {
            label: 'Season Update',
            title: 'Step into Season 9.5 // Dev Vision Vol. 20',
            description: 'Latest season reveal.',
            sourceUrl: 'https://example.com/season',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            thumbnailAlt: 'Season 9.5 thumbnail',
            publishedAt: '2026/08/05',
            videoUrl: 'https://example.com/season-video.mp4',
          },
        ],
      }),
    ).toEqual({
      eyebrow: 'Season update spotlight',
      title: 'Step into Season 9.5 // Dev Vision Vol. 20',
      description: 'Latest season reveal.',
      sourceUrl: 'https://example.com/season',
      date: '2026/08/05',
      hasVideo: true,
    });
  });
});