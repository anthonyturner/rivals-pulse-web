export interface NavigationCategory {
  label: string;
  path: string;
  description: string;
  items: Array<{
    label: string;
    path: string;
    description: string;
    enabled: boolean;
  }>;
}

export const NAVIGATION_CATEGORIES: NavigationCategory[] = [
  {
    label: 'Resources',
    path: '/resources',
    description: 'Videos, guides, stats and a glossary for quick reference.',
    items: [
      { label: 'Media Tutorials', path: '/media-tutorials', description: 'Browse coaching videos by topic.', enabled: true },
      { label: 'Strategist Guides', path: '/strategist-guides', description: 'Study transcript-built support lessons and practice drills.', enabled: true },
      { label: 'User Highlights', path: '/user-highlights', description: 'Review community plays one decision at a time.', enabled: true },
      { label: 'Game Stats', path: '/game-stats', description: 'Review the numbers behind the roster.', enabled: true },
      { label: 'Tier List', path: '/tier-list', description: 'Community hero tiers from RivalsPulse players, by half-season.', enabled: true },
      { label: 'Win Rates', path: '/win-rates', description: 'See hero win rates from RivalsPulse matches.', enabled: true },
      { label: 'Glossary', path: '/glossary', description: 'Translate common hero-shooter terms quickly.', enabled: true },
    ],
  },
  {
    label: 'Tools',
    path: '/tools',
    description: 'Check matchups and build a team before you queue.',
    items: [
      { label: 'Counters', path: '/counters', description: 'Explore practical matchup answers.', enabled: true },
      { label: 'Dive Planner', path: '/dive-planner', description: 'Find heroes that beat several enemy divers at once.', enabled: true },
      { label: 'Team Builder', path: '/team-builder', description: 'Sketch a team composition with intention.', enabled: true },
      { label: 'Learning Paths', path: '/learning-paths', description: 'Focused routes through your next skill.', enabled: false },
      { label: 'Watch Next Quiz', path: '/watch-next', description: 'A quiz that picks your next lesson.', enabled: false },
      { label: 'AI Coach', path: '/ai-coach', description: 'Personalized coaching.', enabled: false },
    ],
  },
];
