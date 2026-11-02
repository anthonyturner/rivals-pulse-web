import { NAVIGATION_CATEGORIES } from '../../navigation/navigation-category.data';

export interface PrimaryNavItem {
  label: string;
  path: string;
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

const ACCOUNT_PATHS = ['/account', '/sign-in'];

const isAtOrBelow = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);

/**
 * The path of the nav item a URL belongs to, or null. A page under Tools or Resources belongs to that
 * item, taken from the category's own page list so the two cannot drift apart.
 */
export function activeNavPath(url: string): string | null {
  const path = url.split(/[?#]/)[0] || '/';

  if (path === HOME_NAV_ITEM.path) {
    return path;
  }

  const direct = [...PRIMARY_NAV_ITEMS.map((item) => item.path), ...ACCOUNT_PATHS].find((base) =>
    isAtOrBelow(path, base),
  );

  return (
    direct ??
    NAVIGATION_CATEGORIES.find((category) => category.items.some((item) => isAtOrBelow(path, item.path)))?.path ??
    null
  );
}
