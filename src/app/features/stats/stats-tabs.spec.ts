import { statsRoutes } from './stats.routes';
import { STATS_TAB_DATA_KEY, STATS_TABS, statsTabLink, statsTabTitle } from './stats-tabs';

describe('the Stats tabs', () => {
  it('are the seven the hub lists, Overview first', () => {
    expect(STATS_TABS.map((tab) => tab.label)).toEqual([
      'Overview',
      'Heroes',
      'Roles',
      'Matchups',
      'Maps',
      'Team comps',
      'Records',
    ]);
  });

  it('each have an address of their own under /stats, with Overview at /stats itself', () => {
    expect(STATS_TABS.map(statsTabLink)).toEqual([
      '/stats',
      '/stats/heroes',
      '/stats/roles',
      '/stats/matchups',
      '/stats/maps',
      '/stats/team-comps',
      '/stats/records',
    ]);
  });

  it('each have their own title and description, so no two tabs claim the same page', () => {
    const titles = STATS_TABS.map(statsTabTitle);
    const descriptions = STATS_TABS.map((tab) => tab.description);

    expect(new Set(titles).size).toBe(STATS_TABS.length);
    expect(new Set(descriptions).size).toBe(STATS_TABS.length);
    expect(titles[0]).toBe('Marvel Rivals community stats | RivalsPulse');
    expect(descriptions.every((description) => description.length > 40 && description.length <= 200)).toBeTrue();
  });

  it('are the only tabs with no content of their own: the Heroes and Maps stand-ins', () => {
    expect(STATS_TABS.filter((tab) => !tab.hasContent).map((tab) => tab.id)).toEqual(['heroes', 'maps']);
  });

  describe('as routes', () => {
    const children = statsRoutes[0].children ?? [];

    it('have one child route per tab, in the same order, under one page', () => {
      expect(statsRoutes.length).toBe(1);
      expect(children.map((route) => route.path)).toEqual(STATS_TABS.map((tab) => tab.path));
    });

    it('carry the Overview title on the page itself, as a fallback for a tab with none', () => {
      expect(statsRoutes[0].title).toBe(statsTabTitle(STATS_TABS[0]));
    });

    it('give each tab its own title, description and tab id', () => {
      children.forEach((route, index) => {
        const tab = STATS_TABS[index];

        expect(route.title).toBe(statsTabTitle(tab));
        expect(route.data).toEqual({ [STATS_TAB_DATA_KEY]: tab.id, description: tab.description });
      });
    });
  });
});
