import type { CommunityFigures, CommunityPerMinute, CommunityRoleFigures } from '../../../../contracts/community-figures.model';
import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';

/** One figure of a role: its label, the number as text, and how long its bar is. */
export interface RoleFigureBar {
  label: string;
  /** The figure with thousands separators, or "Not enough data". */
  value: string;
  /** The figure against the largest role's figure of the same kind, 0 to 100; null when the figure is not shown, so there is no bar to draw. */
  percent: number | null;
}

/** One role's card: its three per-minute figures. */
export interface RoleFigureCard {
  role: string;
  /** The role as a style key, such as `vanguard`. */
  roleKey: string;
  bars: RoleFigureBar[];
}

/** The figures a card carries, in order. */
const FIGURES: readonly { key: keyof CommunityPerMinute; label: string }[] = [
  { key: 'damage', label: 'Damage' },
  { key: 'healing', label: 'Healing' },
  { key: 'blocked', label: 'Damage blocked' },
];

export type RoleFiguresView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      cards: RoleFigureCard[];
      note: string;
    };

export const NO_FIGURE = 'Not enough data';

const NOTE =
  'Per minute played, to the nearest whole number. These are the figures of the players who upload their matches with RivalsPulse: each app only knows its own player, so this describes those players, not everyone in a lobby. A role shows a figure only once enough of their lines carry it.';

/** A whole per-minute figure with thousands separators, or "Not enough data" for one that is not shown. */
export function perMinuteLabel(value: number | null): string {
  return value === null || !Number.isFinite(value) ? NO_FIGURE : value.toLocaleString('en-US');
}

/** Whether any figure in the set is shown. */
export function hasPerMinute(figures: CommunityPerMinute): boolean {
  return figures.damage !== null || figures.healing !== null || figures.blocked !== null;
}

/**
 * What the Stats tab shows for damage, healing and damage blocked per minute: one row per role in
 * the mode selected there. `undefined` means the figures have not answered yet and `null` means they
 * could not be read; neither is "not enough data", which is a real answer.
 */
export function buildRoleFiguresView(
  figures: CommunityFigures | null | undefined,
  modeId: HeroStatsModeId,
): RoleFiguresView {
  if (figures === undefined) {
    return { kind: 'loading' };
  }

  if (figures === null) {
    return { kind: 'unavailable' };
  }

  const mode = figures.modes.find((candidate) => candidate.id === modeId) ?? figures.modes[0];

  if (figures.status !== 'ready' || mode === undefined || !mode.roles.some(hasPerMinute)) {
    const scope = mode === undefined || mode.id === DEFAULT_MODE_ID ? '' : ` in ${mode.label}`;
    const lines = countLabel(figures.minimums.roleLines, 'line', 'lines');

    return {
      kind: 'not-enough-data',
      summary:
        `Not enough data yet. How much damage, healing and damage blocked each role averages per minute${scope}, so you can compare your own. ` +
        `A role's figure appears once ${lines} (one player's figures on one hero for one match) carry it, recorded by at least ${figures.minimums.recorders} different players.`,
    };
  }

  const halfSeasonLabel = figures.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      figures.inPlaceOf === null ? null : halfSeasonFallbackNotice(figures.inPlaceOf.label, halfSeasonLabel),
    cards: roleCards(mode.roles),
    note: NOTE,
  };
}

/** A figure that is shown, or null: a missing or non-finite one has no bar and is never read as zero. */
function shown(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

/** Each figure is scaled to the largest role's, so the cards compare the roles on that figure and not one figure against another. */
function roleCards(roles: readonly CommunityRoleFigures[]): RoleFigureCard[] {
  const largest = new Map(
    FIGURES.map(({ key }) => [key, Math.max(0, ...roles.map((entry) => shown(entry[key]) ?? 0))]),
  );

  return roles.map((entry) => ({
    role: entry.role,
    roleKey: entry.role.toLowerCase(),
    bars: FIGURES.map(({ key, label }) => {
      const value = shown(entry[key]);
      const most = largest.get(key) ?? 0;

      return {
        label,
        value: perMinuteLabel(entry[key]),
        percent: value === null ? null : most > 0 ? (value / most) * 100 : 0,
      };
    }),
  }));
}
