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
      { label: 'Stats', path: '/stats' },
      { label: 'Tier list', path: '/tier-list' },
      { label: 'Hero stats', path: '/win-rates' },
      { label: 'Team comps', path: '/stats/team-comps' },
      { label: 'Pulse Records', path: '/stats/records' },
      { label: 'Counters', path: '/counters' },
      { label: 'Dive planner', path: '/dive-planner' },
      { label: 'Team builder', path: '/team-builder' },
    ],
  },
  {
    id: 'footer-learn',
    heading: 'Learn',
    links: [
      { label: 'Hero guides', path: '/hero-guides' },
      { label: 'Resources', path: '/resources' },
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
      { label: 'Fair play and privacy', path: '/fair-play' },
      { label: 'How we count', path: '/how-we-count' },
      { label: 'Privacy notes', path: '/privacy' },
      { label: 'App privacy policy', path: '/privacy/app' },
    ],
  },
];
