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
    id: 'win-rates',
    eyebrow: 'Featured data · Hero win rates',
    title: 'See how heroes are winning in Rivals Pulse matches',
    description:
      'Every hero with enough counted appearances gets a win rate, ranked from the matches that Rivals Pulse players record. Heroes still short of the minimum show how close they are.',
    sourceNote:
      'Counted from the scoreboards of recorded matches, all ranks together. The page says plainly when there is not enough data yet.',
    actions: [
      {
        label: 'See the win rates',
        routerLink: '/win-rates',
        primary: true,
      },
    ],
    media: {
      kind: 'image',
      imageUrl: '/images/heroes/captain-america.png',
      imageAlt: 'Captain America',
      label: 'Rivals Pulse data',
      title: 'Hero win rates',
      meta: 'Counted from recorded matches',
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
