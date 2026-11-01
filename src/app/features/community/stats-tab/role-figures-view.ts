import type { CommunityFigures, CommunityPerMinute } from '../../../../contracts/community-figures.model';
import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';

export interface RoleFigureRow {
  role: string;
  damage: string;
  healing: string;
  blocked: string;
}

export type RoleFiguresView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      rows: RoleFigureRow[];
      note: string;
    };

export const NO_FIGURE = 'Not enough data';

const NOTE =
  'Per minute played, to the nearest whole number. These are the figures of the players who upload their matches with Rivals Pulse: each app only knows its own player, so this describes those players, not everyone in a lobby. A role shows a figure only once enough of their lines carry it.';

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
        `How much damage, healing and damage blocked each role averages per minute${scope}, so you can compare your own. ` +
        `A role's figure appears once ${lines} carry it, recorded by at least ${figures.minimums.recorders} different players.`,
    };
  }

  const halfSeasonLabel = figures.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice:
      figures.inPlaceOf === null ? null : halfSeasonFallbackNotice(figures.inPlaceOf.label, halfSeasonLabel),
    rows: mode.roles.map((entry) => ({
      role: entry.role,
      damage: perMinuteLabel(entry.damage),
      healing: perMinuteLabel(entry.healing),
      blocked: perMinuteLabel(entry.blocked),
    })),
    note: NOTE,
  };
}
