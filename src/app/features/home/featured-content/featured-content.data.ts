import type {
  ReportHeroAction,
  ReportHeroMedia,
} from '../../../shared/components/report-hero/report-hero.component';

export interface FeaturedContentSlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  sourceNote: string;
  actions: readonly ReportHeroAction[];
  media: ReportHeroMedia;
}

export const FEATURED_CONTENT_SLIDES: readonly FeaturedContentSlide[] = [
  {
    id: 'season-9-week-2-win-rates',
    eyebrow: 'Featured report · Season 9 Week 2',
    title: 'What changed across the hero win-rate curves',
    description:
      'Compare every hero from Bronze through Celestial, follow the biggest Week 2 movers, and see where ladder coordination changes the result.',
    sourceNote:
      'Transcript-built from Nerfpool’s Week 2 report, with approximate spoken values and unchanged Week 1 ranks clearly identified.',
    actions: [
      {
        label: 'Explore the full report',
        routerLink: '/win-rates/9',
        primary: true,
      },
      {
        label: 'Watch the source video',
        href: 'https://www.youtube.com/watch?v=IcHWCu1gHmg',
      },
    ],
    media: {
      kind: 'video',
      videoId: 'IcHWCu1gHmg',
      label: 'Nerfpool',
      title: 'New Meta Report · Season 9 Week 2',
      meta: 'Rank-by-rank hero trends and meta movement',
    },
  },
  {
    id: 'team-builder',
    eyebrow: 'Featured tool · Team planning',
    title: 'Build a six-player team with a clear win condition',
    description:
      'Draft a lineup, check its role balance, and compare utility, damage, sustain, mobility, and ultimate signals before the next queue.',
    sourceNote:
      'The team builder uses the same hero profiles and coaching vocabulary found throughout the roster.',
    actions: [
      {
        label: 'Open the team builder',
        routerLink: '/team-builder',
        primary: true,
      },
      {
        label: 'Review build theory',
        routerLink: '/build-theory',
      },
    ],
    media: {
      kind: 'image',
      imageUrl: '/images/heroes/doctor-strange.png',
      imageAlt: 'Doctor Strange',
      label: 'Practice tool',
      title: 'Team Builder',
      meta: 'Composition scoring and fight-plan signals',
    },
  },
  {
    id: 'strategist-guides',
    eyebrow: 'Featured guides · Strategists',
    title: 'Turn support decisions into repeatable habits',
    description:
      'Study positioning, resource timing, survival, and practice drills built from coaching-video transcripts.',
    sourceNote:
      'Each guide connects its lesson to the original source and turns the core ideas into match-ready cues.',
    actions: [
      {
        label: 'Browse strategist guides',
        routerLink: '/strategist-guides',
        primary: true,
      },
      {
        label: 'Explore all guides',
        routerLink: '/hero-guides',
      },
    ],
    media: {
      kind: 'image',
      imageUrl: '/images/heroes/luna-snow.png',
      imageAlt: 'Luna Snow',
      label: 'Guide collection',
      title: 'Strategist Coaching',
      meta: 'Transcript-built lessons and practice drills',
    },
  },
];
