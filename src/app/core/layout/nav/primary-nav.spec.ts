import { NAVIGATION_CATEGORIES } from '../../navigation/navigation-category.data';
import { PRIMARY_NAV_ITEMS, activeNav } from './primary-nav';

describe('activeNav', () => {
  it('matches a nav item exactly, and a page below it as a section, ignoring the query and fragment', () => {
    expect(activeNav('/heroes')).toEqual({ path: '/heroes', exact: true });
    expect(activeNav('/heroes?tab=1#abilities')).toEqual({ path: '/heroes', exact: true });
    expect(activeNav('/heroes/spider-man')).toEqual({ path: '/heroes', exact: false });
    expect(activeNav('/hero-guides/first-time')).toEqual({ path: '/hero-guides', exact: false });
  });

  it('matches Home on the home page only', () => {
    expect(activeNav('/')).toEqual({ path: '/', exact: true });
    expect(activeNav('/?x=1')).toEqual({ path: '/', exact: true });
    expect(activeNav('/privacy')).toBeNull();
  });

  it('does not match a path that only starts with the same letters', () => {
    expect(activeNav('/heroesque')).toBeNull();
  });

  it('lists Heroes, Stats, Guides and Tools, in that order', () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual(['Heroes', 'Stats', 'Guides', 'Tools']);
    expect(PRIMARY_NAV_ITEMS.map((item) => item.path)).toEqual(['/heroes', '/stats', '/hero-guides', '/tools']);
  });

  it('puts every page under Stats, whichever tab it is and the live tier list and hero stats pages too', () => {
    for (const path of ['/stats/heroes', '/stats/records', '/tier-list', '/win-rates', '/win-rates/10.5']) {
      expect(activeNav(path)).withContext(path).toEqual({ path: '/stats', exact: false });
    }

    expect(activeNav('/stats')).toEqual({ path: '/stats', exact: true });
    expect(activeNav('/stats/records?category=kills')).toEqual({ path: '/stats', exact: false });
  });

  it('puts every page of a category under the nav item that holds it, from the category data itself', () => {
    const navPaths = PRIMARY_NAV_ITEMS.map((item) => item.path);

    for (const category of NAVIGATION_CATEGORIES) {
      for (const page of [category.path, ...category.items.map((item) => item.path)]) {
        const active = activeNav(page);

        expect(active?.path).withContext(page).toBeDefined();
        expect(navPaths).withContext(page).toContain(active?.path as string);
      }
    }
  });

  it('keeps Tools pages under Tools and files the Resources hub and its pages under Guides', () => {
    expect(activeNav('/tools')).toEqual({ path: '/tools', exact: true });
    expect(activeNav('/counters')).toEqual({ path: '/tools', exact: false });
    expect(activeNav('/resources')).toEqual({ path: '/hero-guides', exact: false });
    expect(activeNav('/glossary')).toEqual({ path: '/hero-guides', exact: false });
    expect(activeNav('/strategist-guides')).toEqual({ path: '/hero-guides', exact: false });
  });

  it('matches the account, sign-in and profile pages to themselves', () => {
    for (const path of ['/account', '/sign-in', '/profile']) {
      expect(activeNav(path)).withContext(path).toEqual({ path, exact: true });
    }
  });

  it('matches the admin area and every page under it to the Admin link', () => {
    expect(activeNav('/admin')).toEqual({ path: '/admin', exact: true });
    expect(activeNav('/admin/overview')).toEqual({ path: '/admin', exact: false });
  });
});
