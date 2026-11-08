import type { TileChipKind } from '../../hub/hub-tile.types';

export const TUTORIAL_CATEGORIES = [
  'Fundamentals',
  'Roles',
  'Heroes',
  'Mindset',
  'VOD Reviews',
  'Map Guides',
] as const;

export type TutorialCategory = (typeof TUTORIAL_CATEGORIES)[number];

/** The chip tint of each topic: yellow for learning the game, indigo for the game's own pieces, violet for community reviews. */
export const TUTORIAL_CATEGORY_KINDS: Record<TutorialCategory, TileChipKind> = {
  Fundamentals: 'accent',
  Mindset: 'accent',
  Roles: 'secondary',
  Heroes: 'secondary',
  'VOD Reviews': 'tertiary',
  'Map Guides': 'tertiary',
};

export interface MediaTutorial {
  id: string;
  category: TutorialCategory;
  title: string;
  description: string;
  youtubeId: string;
  sourceUrl: string;
  guideUrl?: string;
  tags: string[];
}

export const MEDIA_TUTORIALS: readonly MediaTutorial[] = [
  {
    id: 'cover-usage',
    category: 'Fundamentals',
    title: 'Strategic Cover Usage in Marvel Rivals',
    description: 'Core cover habits, peeking discipline, and how to trade damage without giving the enemy a free punish.',
    youtubeId: 'rqxP_tKV2vc',
    sourceUrl: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y',
    guideUrl: '/strategic-cover',
    tags: ['Cover', 'Sightlines', 'Survivability'],
  },
  {
    id: 'high-ground',
    category: 'Fundamentals',
    title: 'You Are Using High Ground Wrong',
    description: 'A Marvel Rivals positioning lesson about when high ground creates pressure and when dropping gives away your advantage.',
    youtubeId: '_PdmvN0s0ew',
    sourceUrl: 'https://youtu.be/_PdmvN0s0ew?si=E8lcu1rTkWXSU3mi',
    tags: ['High Ground', 'Angles', 'Map Control'],
  },
  {
    id: 'jeff-space',
    category: 'Heroes',
    title: 'How Number One Jeff Controls Space',
    description: 'Strategist masterclass material focused on space control, support uptime, and choosing which lane to stabilize.',
    youtubeId: 'veOh-WKr4Xw',
    sourceUrl: 'https://youtu.be/veOh-WKr4Xw?si=_s1DeN9iMPJtgUh7',
    tags: ['Jeff', 'Strategist', 'Space'],
  },
  {
    id: 'non-linear-rotations',
    category: 'Fundamentals',
    title: 'Non-linear Rotations in Marvel Rivals',
    description: 'Rotation and pathing concepts for creating new pressure without walking through the enemy main angle.',
    youtubeId: 'oAdjNFeiOrQ',
    sourceUrl: 'https://youtu.be/oAdjNFeiOrQ?si=ZQxCLxHa_fukSotJ',
    tags: ['Rotations', 'Pathing', 'Tempo'],
  },
  {
    id: 'power-positions',
    category: 'Fundamentals',
    title: 'Power Positions in Marvel Rivals',
    description: 'How to choose positions that create pressure, protect your exit, and force enemy attention away from your team.',
    youtubeId: 'FmfiDOyZmrQ',
    sourceUrl: 'https://youtu.be/FmfiDOyZmrQ?si=b8gXQdcpU1Y2vqfF',
    guideUrl: '/power-positions',
    tags: ['Positioning', 'Pressure', 'Map Control'],
  },
  {
    id: 'support-effectively',
    category: 'Roles',
    title: 'How to Support Effectively',
    description: 'Strategist fundamentals for proactive support, resource timing, and maintaining useful pressure.',
    youtubeId: '-iBssvJkLXk',
    sourceUrl: 'https://youtu.be/-iBssvJkLXk?si=TdK-KchPCqEkt_Fb',
    tags: ['Strategist', 'Support', 'Resources'],
  },
  {
    id: 'starlord-breakdown',
    category: 'Heroes',
    title: "Sinatra's Star-Lord Breakdown",
    description: 'Duelist setup, scouting, and fight-timing material using Star-Lord examples.',
    youtubeId: 'YX2xq2RXV7o',
    sourceUrl: 'https://youtu.be/YX2xq2RXV7o?si=1SxRqhS7w1LB4B6E',
    tags: ['Star-Lord', 'Duelist', 'Setup'],
  },
  {
    id: 'killboxes',
    category: 'Fundamentals',
    title: 'Killboxes and Their Value',
    description: 'Fight-planning tutorial on overlapping angles, pressure traps, and when to collapse onto a target.',
    youtubeId: '9bp0D7R9zbg',
    sourceUrl: 'https://youtu.be/9bp0D7R9zbg?si=flVjnb_HF0puZU-3',
    tags: ['Killboxes', 'Angles', 'Focus Fire'],
  },
  {
    id: 'lane-control',
    category: 'Fundamentals',
    title: 'Lane Control and Uptime',
    description: 'Poke-team concepts for holding useful pressure, controlling lanes, and cutting dead time in fights.',
    youtubeId: 'F6EFqod3Kn0',
    sourceUrl: 'https://youtu.be/F6EFqod3Kn0?si=OufYyykEhYZXjgVO',
    tags: ['Lane Control', 'Uptime', 'Poke'],
  },
  {
    id: 'map-guide-hells-heaven',
    category: 'Map Guides',
    title: "Hell's Heaven Map Guide",
    description: 'Map-specific tutorial covering fight locations, route choices, and practical tips for Hell’s Heaven.',
    youtubeId: 'fUsbDOIjlpU',
    sourceUrl: 'https://youtu.be/fUsbDOIjlpU?si=dYm56G3TgKDtJheY',
    tags: ['Map Guide', "Hell's Heaven", 'Domination'],
  },
  {
    id: 'timing',
    category: 'Fundamentals',
    title: 'Timing in Marvel Rivals',
    description: 'Masterclass on creating synchronized pressure instead of entering fights early, late, or alone.',
    youtubeId: 'yftUQIsApMI',
    sourceUrl: 'https://youtu.be/yftUQIsApMI?si=BkzIi2ynIWqEiaOD',
    tags: ['Timing', 'Engage', 'Fight Planning'],
  },
  {
    id: 'target-priority',
    category: 'Fundamentals',
    title: 'Target Priority in Marvel Rivals',
    description: 'Decision-making tutorial on selecting vulnerable, isolated, or resource-light targets.',
    youtubeId: 'HoiwKJLR_tA',
    sourceUrl: 'https://youtu.be/HoiwKJLR_tA?si=_oS8swCV9MkR7aOt',
    tags: ['Target Priority', 'Decision Making', 'Pressure'],
  },
  {
    id: 'vanguard-carry',
    category: 'Roles',
    title: 'How to Carry on Vanguard',
    description: 'Role masterclass on creating space, choosing fight locations, and spending cooldowns with intent.',
    youtubeId: 'TOZZRM5JnSM',
    sourceUrl: 'https://youtu.be/TOZZRM5JnSM?si=ODAVv83RtZxvguXr',
    tags: ['Vanguard', 'Space', 'Cooldowns'],
  },
  {
    id: 'duelist-carry',
    category: 'Roles',
    title: 'How to Carry on Duelist',
    description: 'Role masterclass on scouting, setting up crossfires, and converting pressure into eliminations.',
    youtubeId: '6FGNkCvqhgA',
    sourceUrl: 'https://youtu.be/6FGNkCvqhgA?si=FSi0vTdUwu3O86xG',
    tags: ['Duelist', 'Setup', 'Threat'],
  },
  {
    id: 'strategist-carry',
    category: 'Roles',
    title: 'How to Carry on Strategist',
    description: 'Role masterclass on proactive support, utility reservation, and turning resources into pressure.',
    youtubeId: 'K9Ce8VTHxuc',
    sourceUrl: 'https://youtu.be/K9Ce8VTHxuc?si=0HDhL7-D9wkvjCsJ',
    tags: ['Strategist', 'Utility', 'Resources'],
  },
  {
    id: 'self-review',
    category: 'VOD Reviews',
    title: 'How to Self-review',
    description: 'A practical VOD review framework for finding repeatable decision patterns instead of blaming single moments.',
    youtubeId: 'qbjD4v91UOk',
    sourceUrl: 'https://youtu.be/qbjD4v91UOk',
    tags: ['VOD Review', 'Practice', 'Improvement'],
  },
  {
    id: 'master-consistency',
    category: 'Mindset',
    title: 'Master Consistency in Marvel Rivals',
    description: 'Practice and mentality material for building repeatable performance across ranked blocks.',
    youtubeId: 'r-MDhF7li2s',
    sourceUrl: 'https://youtu.be/r-MDhF7li2s?si=R3DnPYsAr2gsA0iH',
    tags: ['Consistency', 'Mindset', 'Practice'],
  },
  {
    id: 'tilt',
    category: 'Mindset',
    title: 'How to Deal with Tilt',
    description: 'Mental reset tutorial for staying useful after mistakes, pressure swings, and frustrating games.',
    youtubeId: '3leIrDmkHbs',
    sourceUrl: 'https://youtu.be/3leIrDmkHbs?si=oiLno2-O5oqqg9tT',
    tags: ['Tilt', 'Mental', 'Reset'],
  },
];
