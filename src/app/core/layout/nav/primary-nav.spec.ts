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

  it('puts every page of a category under that category, from the category data itself', () => {
    for (const category of NAVIGATION_CATEGORIES) {
      expect(PRIMARY_NAV_ITEMS.map((item) => item.path)).toContain(category.path);

      for (const item of category.items) {
        expect(activeNav(item.path)).withContext(item.path).toEqual({ path: category.path, exact: false });
      }
    }
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
