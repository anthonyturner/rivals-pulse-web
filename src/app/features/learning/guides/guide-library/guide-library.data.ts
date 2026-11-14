import { HERO_GUIDES } from '../hero-guides/hero-guide-data';
import { STRATEGIST_GUIDES } from '../strategist-guides/strategist-guides.data';
import type { GuideCategory, GuideSection, LibraryGuide } from './guide-library.types';

export const GUIDE_CATEGORIES: readonly GuideCategory[] = [
  'Getting started',
  'Hero guides',
  'Fundamentals',
  'Positioning',
  'Team play and mechanics',
  'Strategist lessons',
];

interface GuideSource {
  readonly title: string;
  readonly path: string;
  readonly category: GuideCategory;
  readonly hero: string | null;
  readonly imageUrl: string;
  readonly context: string;
  readonly blurb: string;
  readonly topics: readonly string[];
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function toGuide(source: GuideSource): LibraryGuide {
  const { topics, context, ...guide } = source;

  return {
    ...guide,
    caption: `${source.category} · ${context}`,
    searchText: normalizeSearch([
      source.title,
      source.category,
      source.hero ?? '',
      context,
      source.blurb,
      ...topics,
    ].join(' ')),
  };
}

const STANDALONE_GUIDES: readonly GuideSource[] = [
  {
    title: 'How to play: first-time guide',
    path: '/hero-guides/first-time',
    category: 'Getting started',
    hero: null,
    imageUrl: '/images/heroes/captain-america.png',
    context: 'Beginner guide',
    blurb: 'A complete first-match explanation without the interactive course.',
    topics: ['beginner', 'new player', 'objectives', 'roles'],
  },
  {
    title: 'How to play: interactive course',
    path: '/beginner-interactive-guide',
    category: 'Getting started',
    hero: null,
    imageUrl: '/images/heroes/captain-america.png',
    context: 'Interactive course',
    blurb: 'Learn your first match through an interactive course.',
    topics: ['beginner', 'new player', 'objectives', 'roles'],
  },
  {
    title: 'Power positions',
    path: '/power-positions',
    category: 'Positioning',
    hero: null,
    imageUrl: '/images/heroes/hawkeye.png',
    context: 'Map control',
    blurb: 'Recognize the locations that make your next fight easier.',
    topics: ['high ground', 'angles', 'space', 'pressure'],
  },
  {
    title: 'Strategic cover',
    path: '/strategic-cover',
    category: 'Positioning',
    hero: null,
    imageUrl: '/images/heroes/magneto.png',
    context: 'Cover and sightlines',
    blurb: 'Turn terrain into safer, repeatable positioning decisions.',
    topics: ['cover', 'sightlines', 'survival', 'peeking'],
  },
  {
    title: 'Techniques',
    path: '/techniques',
    category: 'Team play and mechanics',
    hero: null,
    imageUrl: '/images/heroes/iron-man.png',
    context: 'Practice workbook',
    blurb: 'Train practical mechanics and fight habits from the workbook.',
    topics: ['practice', 'drills', 'mechanics', 'habits'],
  },
  {
    title: 'Build theory',
    path: '/build-theory',
    category: 'Team play and mechanics',
    hero: null,
    imageUrl: '/images/heroes/doctor-strange.png',
    context: 'Team composition',
    blurb: 'Understand utility, damage, sustain, mobility, and ultimate plans.',
    topics: ['composition', 'team comp', 'synergy'],
  },
  {
    title: 'How to break triple support',
    path: '/triple-support-counter',
    category: 'Team play and mechanics',
    hero: null,
    imageUrl: '/images/heroes/luna-snow.png',
    context: 'Team composition',
    blurb: 'Use synchronized dive, burst, and displacement to stop the sustain loop.',
    topics: ['composition', 'team comp', 'triple support', 'counter', 'strategist'],
  },
];

export const LIBRARY_GUIDES: readonly LibraryGuide[] = [
  ...HERO_GUIDES.map((guide): LibraryGuide => toGuide({
    title: guide.heroName,
    path: `/hero-guides/${guide.heroId}`,
    category: guide.category === 'hero'
      ? 'Hero guides'
      : guide.heroId === 'coach-mills-ultimate-beginners-guide' ? 'Getting started' : 'Fundamentals',
    hero: guide.category === 'hero' ? guide.heroName : null,
    imageUrl: guide.image,
    context: guide.role === 'Fundamentals' ? 'All roles' : guide.role,
    blurb: guide.summary,
    topics: [guide.sourceLabel, ...guide.sections.map((section) => section.title)],
  })),
  ...STANDALONE_GUIDES.map(toGuide),
  ...STRATEGIST_GUIDES.map((guide): LibraryGuide => toGuide({
    title: guide.title,
    path: `/strategist-guides/${guide.id}`,
    category: 'Strategist lessons',
    hero: guide.heroFocus === 'All Strategists' ? null : guide.heroFocus,
    imageUrl: guide.heroImage,
    context: `${guide.heroFocus} · ${guide.category}`,
    blurb: guide.summary,
    topics: guide.principles.map((principle) => principle.title),
  })),
].sort((a, b) => a.title.localeCompare(b.title));

export const GUIDE_HEROES: readonly string[] = [...new Set(
  LIBRARY_GUIDES.flatMap((guide) => guide.hero ? [guide.hero] : []),
)].sort((a, b) => a.localeCompare(b));

export function findLibraryGuides(query: string, category: string, hero: string): readonly LibraryGuide[] {
  const tokens = normalizeSearch(query).split(' ').filter((token) => token.length > 0);

  return LIBRARY_GUIDES.filter((guide) =>
    (category === '' || guide.category === category)
    && (hero === '' || guide.hero === hero)
    && tokens.every((token) => guide.searchText.includes(token)),
  );
}

export function groupLibraryGuides(guides: readonly LibraryGuide[]): readonly GuideSection[] {
  return GUIDE_CATEGORIES.map((category) => ({
    category,
    guides: guides.filter((guide) => guide.category === category),
  })).filter((section) => section.guides.length > 0);
}
