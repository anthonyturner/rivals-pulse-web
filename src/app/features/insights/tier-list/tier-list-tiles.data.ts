import type { HubLink, HubTileConfig } from '../../hub/hub-tile.types';

/** The two pages the tier list points to, written as hub links so the shared bento can lay them out. */
export const TIER_LIST_LINKS: readonly HubLink[] = [
  {
    label: 'How we count',
    path: '/how-we-count',
    description:
      'RivalsPulse has no rank breakdown, so every figure covers all ranks together. Quick Match and Competitive are counted together unless you pick a single mode. A hero on both teams of one match is counted twice. Matches without a win or a loss, and matches where the game did not say which mode they were, are left out.',
  },
  {
    label: 'Hero stats',
    path: '/win-rates',
    description: 'Exact figures for every hero: win rate, pick rate and games played.',
  },
];

/** The method note leads, over key art; the link to the exact figures is a smaller tile beside it. */
export const TIER_LIST_TILES: readonly HubTileConfig[] = [
  {
    path: '/how-we-count',
    size: 'half',
    chip: { kind: 'tertiary', label: 'Community' },
    preview: null,
    imageUrl: '/images/site/heroes-banner.jpg',
  },
  { path: '/win-rates', size: 'half', chip: { kind: 'secondary', label: 'Stats' }, preview: null, imageUrl: null },
];
