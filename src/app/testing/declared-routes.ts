import { Routes, UrlSegment, UrlSegmentGroup } from '@angular/router';

/**
 * Whether the route config has a route for an address such as `/heroes`. A route can declare its
 * address as a `path` or with a `matcher`, and a spec that only reads `path` misses the second kind.
 */
export function declaresRoute(routes: Routes, address: string): boolean {
  const segments = address
    .split('/')
    .filter((part) => part !== '')
    .map((part) => new UrlSegment(part, {}));
  const path = segments.map((segment) => segment.path).join('/');

  return routes.some((route) =>
    route.matcher
      ? route.matcher(segments, new UrlSegmentGroup([], {}), route) !== null
      : route.path === path,
  );
}
