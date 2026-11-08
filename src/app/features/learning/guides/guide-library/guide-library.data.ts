import { HERO_ROLE_CHIP_KINDS } from '../../../hub/hero-role-chip';
import type { HubLink, HubTileConfig, TileChipKind, TileSize } from '../../../hub/hub-tile.types';
import { HERO_GUIDES, HeroGuide } from '../hero-guides/hero-guide-data';
import { STRATEGIST_GUIDES } from '../strategist-guides/strategist-guides.data';

interface LibraryCard {
  title: string;
  path: string;
  imageUrl: string;
  caption: string | null;
  captionKind: TileChipKind;
  blurb: string;
}

interface LibraryGroup {
  title: string;
  cards: LibraryCard[];
}

/** A group of guides ready for the bento: its links, and the tile each one is given. */
export interface GuideSection {
  title: string;
  links: HubLink[];
  tiles: HubTileConfig[];
}

const ROLE_CHIP_KINDS: Record<HeroGuide['role'], TileChipKind> = { ...HERO_ROLE_CHIP_KINDS, Fundamentals: 'accent' };

const guidesById = new Map(HERO_GUIDES.map((guide) => [guide.heroId, guide]));

/** The guides to list, in order, each with the caption it carries. */
function guideCards(entries: ReadonlyArray<readonly [heroId: string, caption: string]>): LibraryCard[] {
  return entries.flatMap(([heroId, caption]) => {
    const guide = guidesById.get(heroId);

    return guide ? [toCard(guide, caption, 'accent')] : [];
  });
}

function toCard(guide: HeroGuide, caption: string, captionKind: TileChipKind): LibraryCard {
  return {
    title: guide.heroName,
    path: `/hero-guides/${guide.heroId}`,
    imageUrl: guide.image,
    caption,
    captionKind,
    blurb: guide.poolJob,
  };
}

function pageCard(
  title: string,
  path: string,
  hero: string,
  blurb: string,
  caption: string | null = null,
  captionKind: TileChipKind = 'accent',
): LibraryCard {
  return { title, path, imageUrl: `/images/heroes/${hero}.png`, caption, captionKind, blurb };
}

const GROUPS: LibraryGroup[] = [
  {
    title: 'Start here',
    cards: [
      ...guideCards([['coach-mills-ultimate-beginners-guide', 'Coach Mills']]),
      pageCard(
        'How to play: first-time guide',
        '/hero-guides/first-time',
        'captain-america',
        'A complete first-match explanation without the interactive course.',
      ),
      pageCard(
        'How to play: interactive course',
        '/beginner-interactive-guide',
        'captain-america',
        'A complete first-match explanation with the interactive course.',
      ),
    ],
  },
  {
    title: 'Hero guides',
    cards: HERO_GUIDES.filter((guide) => guide.category === 'hero').map((guide) =>
      toCard(guide, guide.role, ROLE_CHIP_KINDS[guide.role]),
    ),
  },
  {
    title: 'Fundamentals',
    cards: guideCards([
      ['neutral-game-fundamentals', 'All roles'],
      ['survival-discipline', 'All roles'],
      ['engagement-discipline', 'All roles'],
      ['tempo-and-ultimate-economy', 'All roles'],
      ['season-8-5-discipline', 'All roles'],
      ['presence-pressure', 'All roles'],
      ['tank-fundamentals-turns-space', 'Vanguard'],
      ['duelist-pressure-over-damage', 'Duelist'],
      ['duelist-disengage-discipline', 'Duelist'],
      ['duelist-target-priority', 'Duelist'],
      ['duelist-off-angle-short', 'Duelist'],
      ['dps-pressure-short', 'Duelist'],
      ['duelist-disengage-short', 'Duelist'],
      ['target-priority-short', 'Duelist'],
    ]),
  },
  {
    title: 'Habits and team play',
    cards: [
      pageCard(
        'Hero stats',
        '/win-rates',
        'peni-parker',
        'Compare hero win and pick rates in matches RivalsPulse players recorded.',
        'RivalsPulse matches',
        'secondary',
      ),
      pageCard('Techniques', '/techniques', 'iron-man', 'Train practical mechanics and fight habits from the workbook.'),
      pageCard('Power positions', '/power-positions', 'hawkeye', 'Recognize the locations that make your next fight easier.'),
      pageCard('Strategic cover', '/strategic-cover', 'magneto', 'Turn terrain into safer, repeatable decisions.'),
      pageCard('Build theory', '/build-theory', 'doctor-strange', 'Understand utility, damage, sustain, mobility, and ultimate plans.'),
      pageCard(
        'How to break triple support',
        '/triple-support-counter',
        'luna-snow',
        'Use synchronized dive, burst, and displacement to stop the sustain loop.',
      ),
    ],
  },
  {
    title: 'Strategist lessons',
    cards: [
      pageCard(
        'Strategist video guides',
        '/strategist-guides',
        'luna-snow',
        'Positioning, healing, ultimates and decision rules, taught in short video lessons.',
        `${STRATEGIST_GUIDES.length} lessons`,
        ROLE_CHIP_KINDS.Strategist,
      ),
    ],
  },
];

/**
 * The sizes for a group of `count` guides, in order, so every row of the six-column grid fills. The
 * first guide leads: beside it two small tiles fill its two rows, or a tall one when there is only
 * one more, and a guide on its own takes the whole row. The rest go three to a row, with a leftover
 * one or two widened to take up the row.
 */
export function guideTileSizes(count: number): TileSize[] {
  if (count <= 1) {
    return count === 1 ? ['wide'] : [];
  }

  if (count === 2) {
    return ['feature', 'tall'];
  }

  const sizes: TileSize[] = ['feature', 'third', 'third'];

  for (let left = count - 3; left > 0; ) {
    const row = left === 1 ? 1 : left === 2 || left === 4 ? 2 : 3;

    sizes.push(...Array<TileSize>(row).fill(row === 1 ? 'wide' : row === 2 ? 'half' : 'third'));
    left -= row;
  }

  return sizes;
}

/** `lazyArt` says whether the group's lead art starts below the fold: true for every group but the first, which opens the page. */
function toSection(group: LibraryGroup, groupIndex: number): GuideSection {
  const lazyArt = groupIndex > 0;
  const sizes = guideTileSizes(group.cards.length);

  return {
    title: group.title,
    links: group.cards.map((card) => ({ label: card.title, path: card.path, description: card.blurb })),
    tiles: group.cards.map((card, index): HubTileConfig => {
      const chip = card.caption ? { kind: card.captionKind, label: card.caption } : null;

      return index === 0
        ? { path: card.path, size: sizes[index], chip, preview: null, imageUrl: card.imageUrl, imageFit: 'portrait', lazyArt }
        : { path: card.path, size: sizes[index], chip, preview: null, imageUrl: null, thumbnailUrl: card.imageUrl };
    }),
  };
}

/** The Guides hub's groups, in the order they are listed. */
export const GUIDE_SECTIONS: readonly GuideSection[] = GROUPS.map(toSection);
