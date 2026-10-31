import { emptyHomeContent, fullHomeContent } from '../home-content.fixtures';
import { buildGameNewsView, RAIL_LIST_SLOTS } from './game-news-view';

describe('buildGameNewsView', () => {
  const full = buildGameNewsView(fullHomeContent, 'October 9, 2026 – ongoing');

  it('shows the season at a glance with its dates and the latest tuning', () => {
    expect(full.season).toEqual({
      heading: 'Season status',
      value: 'Live now',
      dateRange: 'October 9, 2026 – ongoing',
      tuning: {
        label: 'Latest tuning',
        title: 'Balance post',
        meta: 'Oct 24 · Balance',
        url: 'https://example.com/tuning',
        linkLabel: 'Official balance post',
      },
    });
  });

  it('shows the newest hero', () => {
    expect(full.newestHero).toEqual({
      heading: 'Newest hero',
      name: 'Gorr The God Butcher',
      detail: 'Season 10 latest release',
      imageUrl: '/images/heroes/gorr.png',
    });
  });

  it('lists at most three updates and three events', () => {
    expect(full.updates?.items.map((item) => item.title)).toEqual(['Update 1', 'Update 2', 'Update 3']);
    expect(full.events?.items.map((item) => item.title)).toEqual(['Event title 1', 'Event title 2', 'Event title 3']);
    expect(full.updates?.items.length).toBe(RAIL_LIST_SLOTS);
  });

  it('takes the block headings and the events source from the dashboard content', () => {
    expect(full.updates?.heading).toBe('Latest news and patch notes');
    expect(full.events).toEqual(
      jasmine.objectContaining({ heading: 'Events and rewards', sourceLabel: 'Official patch notes' }),
    );
  });

  it('carries the season update spotlight, with its video', () => {
    expect(full.spotlight).toEqual(
      jasmine.objectContaining({ title: 'Step into Season 10 // Dev Vision Vol. 21', hasVideo: true }),
    );
    expect(full.hasNews).toBeTrue();
  });

  it('leaves the date out, without error, while the half-season dates are unknown', () => {
    expect(buildGameNewsView(fullHomeContent, '').season?.dateRange).toBe('');
  });

  it('omits the tuning line when there is no tuning post', () => {
    expect(buildGameNewsView({ ...fullHomeContent, latestTuning: null }, '').season?.tuning).toBeNull();
  });

  it('collapses every block, and says there is no news, when the content is empty', () => {
    const empty = buildGameNewsView(emptyHomeContent, '');

    expect(empty).toEqual({
      season: null,
      newestHero: null,
      updates: null,
      spotlight: null,
      events: null,
      hasNews: false,
    });
  });

  it('collapses a block on its own: no newest hero name means no hero block', () => {
    const view = buildGameNewsView(
      {
        ...fullHomeContent,
        seasonGlance: { ...fullHomeContent.seasonGlance!, latestHero: { ...fullHomeContent.seasonGlance!.latestHero, name: '' } },
      },
      '',
    );

    expect(view.newestHero).toBeNull();
    expect(view.season).not.toBeNull();
  });

  it('shows a spotlight without a video button when the season update has no video', () => {
    const [update] = fullHomeContent.latestNews;
    const view = buildGameNewsView({ ...fullHomeContent, latestNews: [{ ...update, videoUrl: undefined }] }, '');

    expect(view.spotlight?.hasVideo).toBeFalse();
  });

  it('prints no undefined or NaN', () => {
    expect(JSON.stringify(full)).not.toMatch(/undefined|NaN/);
  });
});
