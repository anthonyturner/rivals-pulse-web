import { NAVIGATION_CATEGORIES } from '../../navigation/navigation-category.data';

export interface PrimaryNavItem {
  readonly label: string;
  readonly path: string;
}

/** Home is the brand link on wide screens, so the bar lists it only in the menu. */
export const HOME_NAV_ITEM: PrimaryNavItem = { label: 'Home', path: '/' };

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { label: 'Heroes', path: '/heroes' },
  { label: 'Guides', path: '/hero-guides' },
  { label: 'Tools', path: '/tools' },
  { label: 'Resources', path: '/resources' },
  { label: 'Community', path: '/community' },
];

/** The signed-in visitor's own stats page, linked beside the account item. */
export const PROFILE_PATH = '/profile';

const ACCOUNT_PATHS = ['/account', '/sign-in', PROFILE_PATH];

const isAtOrBelow = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);

export interface ActiveNav {
  /** The path of the nav item the URL belongs to. */
  readonly path: string;
  /** True when the URL is that item's own page, false when it is a page under it. */
  readonly exact: boolean;
}

/**
 * The nav item a URL belongs to, or null. A page under Tools or Resources belongs to that item,
 * taken from the category's own page list so the two cannot drift apart.
 */
export function activeNav(url: string): ActiveNav | null {
  const path = url.split(/[?#]/)[0] || '/';

  if (path === HOME_NAV_ITEM.path) {
    return { path, exact: true };
  }

  const direct = [...PRIMARY_NAV_ITEMS.map((item) => item.path), ...ACCOUNT_PATHS].find((base) =>
    isAtOrBelow(path, base),
  );

  if (direct) {
    return { path: direct, exact: path === direct };
  }

  const category = NAVIGATION_CATEGORIES.find((candidate) =>
    candidate.items.some((item) => isAtOrBelow(path, item.path)),
  );

  return category ? { path: category.path, exact: false } : null;
}
