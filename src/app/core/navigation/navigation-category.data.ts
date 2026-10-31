export interface NavigationCategory {
  label: string;
  path: string;
  eyebrow: string;
  title: string;
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
    eyebrow: 'Reference Desk',
    title: 'Keep the useful information within reach.',
    description:
      'Quick references for concepts, current numbers, and lessons you can watch when you need an example.',
    items: [
      { label: 'Media Tutorials', path: '/media-tutorials', description: 'Browse coaching videos by topic.', enabled: true },
      { label: 'Strategist Guides', path: '/strategist-guides', description: 'Study transcript-built support lessons and practice drills.', enabled: true },
      { label: 'User Highlights', path: '/user-highlights', description: 'Review community plays one decision at a time.', enabled: true },
      { label: 'Game Stats', path: '/game-stats', description: 'Review the numbers behind the roster.', enabled: true },
      { label: 'Tier List', path: '/tier-list', description: 'Community hero tiers from Rivals Pulse players, by half-season.', enabled: true },
      { label: 'Win Rates', path: '/win-rates', description: 'See hero win rates from Rivals Pulse matches.', enabled: true },
      { label: 'Glossary', path: '/glossary', description: 'Translate common hero-shooter terms quickly.', enabled: true },
    ],
  },
  {
    label: 'Tools',
    path: '/tools',
    eyebrow: 'Practice Tools',
    title: 'Turn a confusing match into a clear next step.',
    description:
      'Use these tools before you queue, after a tough fight, or when you want a more deliberate practice session.',
    items: [
      { label: 'Counters', path: '/counters', description: 'Explore practical matchup answers.', enabled: true },
      { label: 'Team Builder', path: '/team-builder', description: 'Sketch a team composition with intention.', enabled: true },
      { label: 'Learning Paths', path: '/learning-paths', description: 'Focused routes through your next skill are coming soon.', enabled: false },
      { label: 'Watch Next Quiz', path: '/watch-next', description: 'A quiz that picks your next lesson is coming soon.', enabled: false },
      { label: 'AI Coach', path: '/ai-coach', description: 'Personalized coaching is coming soon.', enabled: false },
    ],
  },
];
