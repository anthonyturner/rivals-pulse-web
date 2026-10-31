import type { CommunityFigures, CommunityHeroFigures, CommunityPerMinute } from '../../../../contracts/community-figures.model';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import type { CommunityHeroRow } from '../community-hero-list/community-hero-list.component';
import { perMinuteLabel } from '../stats-tab/role-figures-view';

/** Heroes listed under each figure: a summary, not a table of every hero. */
export const HERO_FIGURES_LEADERS = 5;

type FigureKey = keyof CommunityPerMinute;

export interface HeroFigureGroup {
  key: FigureKey;
  title: string;
  /** Names what the figure is, for a screen reader. */
  figureLabel: string;
  heroes: CommunityHeroRow[];
}

export type HeroFiguresView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      groups: HeroFigureGroup[];
    };

const GROUPS: readonly { key: FigureKey; title: string; figureLabel: string }[] = [
  { key: 'damage', title: 'Most damage per minute', figureLabel: 'Damage per minute' },
  { key: 'healing', title: 'Most healing per minute', figureLabel: 'Healing per minute' },
  { key: 'blocked', title: 'Most damage blocked per minute', figureLabel: 'Damage blocked per minute' },
];

/**
 * What the Heroes tab shows for damage, healing and damage blocked per minute: the leaders of each
 * figure among the heroes that have enough lines, in the Quick Match and Competitive blend like the
 * rest of the tab. `undefined` means the figures have not answered yet and `null` means they could
 * not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroFiguresView(
  figures: CommunityFigures | null | undefined,
  identities: HeroIdentities,
): HeroFiguresView {
  if (figures === undefined) {
    return { kind: 'loading' };
  }

  if (figures === null) {
    return { kind: 'unavailable' };
  }

  const heroes = figures.modes[0]?.heroes ?? [];

  if (figures.status !== 'ready' || !heroes.some(hasFigure)) {
    return {
      kind: 'not-enough-data',
      summary:
        `A hero's damage, healing and damage blocked per minute appear once ${countLabel(figures.minimums.heroLines, 'line', 'lines')} ` +
        `carry them, recorded by at least ${figures.minimums.recorders} different players.`,
    };
  }

  const halfSeasonLabel = figures.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: figures.inPlaceOf === null ? null : halfSeasonFallbackNotice(figures.inPlaceOf.label, halfSeasonLabel),
    groups: GROUPS.map((group) => ({ ...group, heroes: leaders(heroes, group.key, identities) })),
  };
}

function hasFigure(hero: CommunityHeroFigures): boolean {
  return hero.damage !== null || hero.healing !== null || hero.blocked !== null;
}

/** The heroes with the highest rate of one figure; a hero that does not have it, or has none of it, is not a leader. */
function leaders(heroes: readonly CommunityHeroFigures[], key: FigureKey, identities: HeroIdentities): CommunityHeroRow[] {
  return heroes
    .flatMap((hero) => {
      const rate = hero[key];

      return rate !== null && Number.isFinite(rate) && rate > 0 ? [{ hero, rate, cell: heroCell(hero.hero, identities) }] : [];
    })
    .sort((a, b) => b.rate - a.rate || a.cell.name.localeCompare(b.cell.name))
    .slice(0, HERO_FIGURES_LEADERS)
    .map(({ rate, cell }) => ({ ...cell, figure: perMinuteLabel(rate) }));
}
