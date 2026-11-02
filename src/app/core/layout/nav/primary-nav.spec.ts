import { NAVIGATION_CATEGORIES } from '../../navigation/navigation-category.data';
import { PRIMARY_NAV_ITEMS, activeNavPath } from './primary-nav';

describe('activeNavPath', () => {
  it('matches a nav item and the pages below it, and ignores the query and fragment', () => {
    expect(activeNavPath('/heroes')).toBe('/heroes');
    expect(activeNavPath('/heroes/spider-man?tab=1#abilities')).toBe('/heroes');
    expect(activeNavPath('/hero-guides/first-time')).toBe('/hero-guides');
  });

  it('matches Home on the home page only', () => {
    expect(activeNavPath('/')).toBe('/');
    expect(activeNavPath('/?x=1')).toBe('/');
    expect(activeNavPath('/privacy')).toBeNull();
  });

  it('does not match a path that only starts with the same letters', () => {
    expect(activeNavPath('/heroesque')).toBeNull();
  });

  it('puts every page of a category under that category, from the category data itself', () => {
    for (const category of NAVIGATION_CATEGORIES) {
      expect(PRIMARY_NAV_ITEMS.map((item) => item.path)).toContain(category.path);

      for (const item of category.items) {
        expect(activeNavPath(item.path)).withContext(item.path).toBe(category.path);
      }
    }
  });

  it('matches the account and sign-in pages to themselves', () => {
    expect(activeNavPath('/account')).toBe('/account');
    expect(activeNavPath('/sign-in')).toBe('/sign-in');
  });
});
