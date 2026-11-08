import type { HubLink, HubTileConfig, TileChip } from '../hub/hub-tile.types';
import { CommunityTotalsPreviewComponent } from './community-totals-preview/community-totals-preview.component';

/** The pages the Community page points to, written as hub links so the shared bento can lay them out. */
export const COMMUNITY_LINKS: readonly HubLink[] = [
  {
    label: 'How we count',
    path: '/how-we-count',
    description: 'How each number here is counted, and why one can be missing until enough matches back it.',
  },
  {
    label: 'Privacy notes',
    path: '/privacy',
    description: 'What the totals are made from. No names or ids are shown.',
  },
  {
    label: 'My stats',
    path: '/profile',
    description: 'Your own matches and insights, for your account only.',
  },
];

const COMMUNITY: TileChip = { kind: 'tertiary', label: 'Community' };
const PRIVACY: TileChip = { kind: 'secondary', label: 'Privacy' };
const ACCOUNT: TileChip = { kind: 'secondary', label: 'Your account' };

/** How each link looks: the lead tile carries key art and the live totals, and the other two are small. */
export const COMMUNITY_TILES: readonly HubTileConfig[] = [
  {
    path: '/how-we-count',
    size: 'feature',
    chip: COMMUNITY,
    preview: CommunityTotalsPreviewComponent,
    imageUrl: '/images/site/heroes-banner.jpg',
  },
  { path: '/privacy', size: 'third', chip: PRIVACY, preview: null, imageUrl: null },
  { path: '/profile', size: 'third', chip: ACCOUNT, preview: null, imageUrl: null },
];
