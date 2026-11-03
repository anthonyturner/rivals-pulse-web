export interface FooterLink {
  readonly label: string;
  readonly path: string;
}

export interface FooterColumn {
  /** Unique within the footer: it names the heading the column's list is labelled by. */
  readonly id: string;
  readonly heading: string;
  readonly links: readonly FooterLink[];
}

/** The footer's link columns, grouped by area. Each path is a released route; the spec holds them to that. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    id: 'footer-stats',
    heading: 'Stats & tools',
    links: [
      { label: 'Heroes', path: '/heroes' },
      { label: 'Community stats', path: '/community' },
      { label: 'Tier list', path: '/tier-list' },
      { label: 'Win rates', path: '/win-rates' },
      { label: 'Game stats', path: '/game-stats' },
      { label: 'Counters', path: '/counters' },
      { label: 'Team builder', path: '/team-builder' },
    ],
  },
  {
    id: 'footer-learn',
    heading: 'Learn',
    links: [
      { label: 'Hero guides', path: '/hero-guides' },
      { label: 'Strategist guides', path: '/strategist-guides' },
      { label: 'Media tutorials', path: '/media-tutorials' },
      { label: 'User highlights', path: '/user-highlights' },
      { label: 'Techniques', path: '/techniques' },
      { label: 'Glossary', path: '/glossary' },
    ],
  },
  {
    id: 'footer-rivalspulse',
    heading: 'RivalsPulse',
    links: [
      { label: 'FAQ', path: '/faq' },
      { label: 'How we count', path: '/how-we-count' },
      { label: 'Privacy notes', path: '/privacy' },
    ],
  },
];
