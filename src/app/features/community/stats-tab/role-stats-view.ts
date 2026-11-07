import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import type { RoleStats, RoleStatsRole } from '../../../../contracts/role-stats.model';
import { DEFAULT_MODE_ID, modeCaveat, selectableModes } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';

export interface RoleFigure {
  label: string;
  value: string;
}

export interface RoleCard {
  role: string;
  appearancesLabel: string;
  ready: boolean;
  /** Empty until the role reaches the minimum. */
  figures: RoleFigure[];
  /** Says how far the role is from the minimum; empty once it is ready. */
  message: string;
}

export interface RoleModeOption {
  id: HeroStatsModeId;
  label: string;
  selected: boolean;
}

export type RoleStatsView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      /** Set for a mode whose numbers do not mean what Quick Match and Competitive do. */
      caveat: string | null;
      /** The modes to switch between; empty when there is only one, so no switch is drawn. */
      modes: RoleModeOption[];
      cards: RoleCard[];
      sample: string;
    }
  | { kind: 'not-enough-data'; summary: string };

const NO_FIGURE = 'Not enough data';

/**
 * What the Stats tab shows. `undefined` means the stats have not answered yet and `null` means they
 * could not be read; neither is "not enough data", which is a real answer.
 */
export function buildRoleStatsView(
  stats: RoleStats | null | undefined,
  selectedModeId: HeroStatsModeId,
): RoleStatsView {
  if (stats === undefined) {
    return { kind: 'loading' };
  }

  if (stats === null) {
    return { kind: 'unavailable' };
  }

  if (stats.status !== 'ready') {
    const offered = new Set(offeredModes(stats, DEFAULT_MODE_ID).map((mode) => mode.id));
    const mostLines = Math.max(
      0,
      ...stats.modes
        .filter((mode) => offered.has(mode.id))
        .flatMap((mode) => mode.roles.map((entry) => entry.appearances)),
    );
    const minimum = countLabel(stats.minimumLines, 'line', 'lines');

    return {
      kind: 'not-enough-data',
      summary:
        'What a normal KDA, final hits and win rate look like for each role, so you can compare your own. ' +
        `A role's figures appear once it has ${minimum} in a mode` +
        (mostLines > 0 ? `; the most any role has so far is ${countLabel(mostLines, 'line', 'lines')}.` : '.'),
    };
  }

  const offered = offeredModes(stats, selectedModeId);
  const chosenId = offered.find((option) => option.id === selectedModeId)?.id ?? offered[0]?.id;
  const chosen = stats.modes.find((mode) => mode.id === chosenId) ?? stats.modes[0];
  const namedMode = chosen.id === DEFAULT_MODE_ID ? undefined : chosen.label;

  return {
    kind: 'ready',
    halfSeasonLabel: stats.halfSeason?.label ?? null,
    notice:
      stats.inPlaceOf === null
        ? null
        : halfSeasonFallbackNotice(stats.inPlaceOf.label, stats.halfSeason?.label ?? null),
    caveat: modeCaveat(chosen.id),
    modes: offered.length > 1 ? offered.map((mode) => ({ ...mode, selected: mode.id === chosen.id })) : [],
    cards: chosen.roles.map((entry) => cardOf(entry, stats.minimumLines, namedMode)),
    sample:
      'A line is one player in one match. Figures are averages per line, pooled across every player on the scoreboard. The win rate counts only matches with a win or a loss. Matches with no recorded mode are left out.',
  };
}

/** The modes with at least one line in a decided match, plus the one `selected`; see `selectableModes`. */
function offeredModes(stats: RoleStats, selected: HeroStatsModeId) {
  return selectableModes(
    stats.modes.map((mode) => ({
      id: mode.id,
      label: mode.label,
      hasMatches: mode.roles.some((entry) => entry.appearances > 0),
    })),
    selected,
  );
}

/** `modeLabel` is set when one mode is counted on its own, so a role short of lines says which mode. */
function cardOf(entry: RoleStatsRole, minimumLines: number, modeLabel?: string): RoleCard {
  const shortOf = modeLabel === undefined ? 'Not enough data yet' : `Not enough data yet in ${modeLabel}`;
  const ready = entry.status === 'ready';

  return {
    role: entry.role,
    appearancesLabel: countLabel(entry.appearances, 'line', 'lines'),
    ready,
    figures: ready
      ? [
          { label: 'Win rate', value: figure(entry.winRate, percentLabel) },
          { label: 'KDA', value: figure(entry.kda, (value) => value.toFixed(2)) },
          { label: 'Kills', value: figure(entry.killsAverage, oneDecimal) },
          { label: 'Deaths', value: figure(entry.deathsAverage, oneDecimal) },
          { label: 'Assists', value: figure(entry.assistsAverage, oneDecimal) },
          { label: 'Final hits', value: figure(entry.finalHitsAverage, oneDecimal) },
        ]
      : [],
    message: ready
      ? ''
      : entry.appearances > 0
        ? `${shortOf}: ${entry.appearances} of ${minimumLines} lines.`
        : `${shortOf}: no lines recorded so far.`,
  };
}

/** A figure the role does not have, or one that is not a finite number, reads as missing, never "NaN". */
function figure(value: number | null, format: (value: number) => string): string {
  return value === null || !Number.isFinite(value) ? NO_FIGURE : format(value);
}

function oneDecimal(value: number): string {
  return value.toFixed(1);
}
