import type { TeamLineupShape, TeamLineups } from '../../../../contracts/team-lineups.model';
import { countLabel, percentLabel } from '../../../shared/utilities/stat-labels';
import { sectionSeasonNotice } from './section-season-notice';

export interface LineupFiguresView {
  /** "12.3%": the share of teams that ran this line-up. */
  pickRateLabel: string;
  winRateLabel: string;
  teams: number;
}

export interface LineupRowView {
  /** "2-2-2": Vanguards, Duelists, Strategists, in that order. */
  shape: string;
  /** "2 tanks · 2 DPS · 2 supports": the shape in the words players use. */
  caption: string;
  /** The same for a screen reader, which would read the dots and the dashes aloud. */
  spoken: string;
  /** "Triple support" or "Quad support" for three or more Strategists; null for any other shape. */
  supportLabel: string | null;
  /** Null while fewer teams than the minimum ran it: the row is listed, with no figures. */
  figures: LineupFiguresView | null;
}

/**
 * - `unavailable`: the line-ups could not be loaded, which is not the same as there being none.
 * - `not-enough-data`: no line-up has reached the minimum in the half-season and mode shown.
 * - `ready`: at least one has. Its rows are the line-ups with figures, most played first, then the
 *   ones too thin to show a figure for.
 */
export type LineupsView =
  | { state: 'unavailable' }
  | { state: 'not-enough-data'; notice: string | null; minimumLabel: string }
  | {
      state: 'ready';
      notice: string | null;
      /** "50 teams": what a line-up needs before its figures are shown. */
      minimumLabel: string;
      rows: LineupRowView[];
    };

/**
 * Turns the line-ups into what the Line-ups section draws: the line-ups with figures, most played
 * first, then the ones too thin to show a figure for. `shownSeasonId` is the half-season the rest of
 * the page shows; the section names its own when it differs.
 */
export function buildLineupsView(lineups: TeamLineups | null, shownSeasonId: number | null): LineupsView {
  if (lineups === null) {
    return { state: 'unavailable' };
  }

  const notice = sectionSeasonNotice('Line-ups', lineups, shownSeasonId);
  const minimumLabel = countLabel(lineups.minimumTeams, 'team', 'teams');
  const withFigures = lineups.shapes
    .filter(isReadable)
    .sort((a, b) => b.teams - a.teams || a.shape.localeCompare(b.shape))
    .map((shape) => rowOf(shape));
  const thin = lineups.shapes.filter((shape) => shape.status === 'not-enough-data').map((shape) => rowOf(shape, null));

  return withFigures.length === 0
    ? { state: 'not-enough-data', notice, minimumLabel }
    : { state: 'ready', notice, minimumLabel, rows: [...withFigures, ...thin] };
}

/**
 * The sentence for the page's method note: what the pick rate is out of, and who is left out. Null
 * when the line-ups could not be loaded or no team was classified.
 */
export function lineupsMethodNote(lineups: TeamLineups | null): string | null {
  if (lineups === null) {
    return null;
  }

  const { classifiedTeams, unclassifiedTeams } = lineups;
  const sentences = [
    classifiedTeams > 0
      ? `Line-up pick rates are out of the ${countLabel(classifiedTeams, 'team', 'teams')} whose heroes all have a known role.`
      : null,
    unclassifiedTeams > 0
      ? `${countLabel(unclassifiedTeams, 'team', 'teams')} had a hero no role is known for (one the game did not record, for instance) and ${unclassifiedTeams === 1 ? 'is' : 'are'} in no line-up.`
      : null,
  ].filter((sentence) => sentence !== null);

  return sentences.length === 0 ? null : sentences.join(' ');
}

type ReadableShape = TeamLineupShape & { teams: number; wins: number; pickRate: number; winRate: number };

/** A shape marked ready with a missing or non-numeric figure would show NaN, so it is skipped. */
function isReadable(shape: TeamLineupShape): shape is ReadableShape {
  return (
    shape.status === 'ready' &&
    shape.teams !== null &&
    shape.teams > 0 &&
    [shape.wins, shape.pickRate, shape.winRate].every((figure) => figure !== null && Number.isFinite(figure))
  );
}

function rowOf(shape: TeamLineupShape, figures: LineupFiguresView | null = figuresOf(shape)): LineupRowView {
  const { vanguards, duelists, strategists } = shape;
  const parts = [
    countLabel(vanguards, 'tank', 'tanks'),
    `${duelists} DPS`,
    countLabel(strategists, 'support', 'supports'),
  ];

  return {
    shape: shape.shape,
    caption: parts.join(' · '),
    spoken: `${parts[0]}, ${parts[1]} and ${parts[2]}`,
    supportLabel: strategists < 3 ? null : strategists === 3 ? 'Triple support' : 'Quad support',
    figures,
  };
}

function figuresOf(shape: TeamLineupShape): LineupFiguresView | null {
  return isReadable(shape)
    ? {
        pickRateLabel: percentLabel(shape.pickRate * 100),
        winRateLabel: percentLabel(shape.winRate * 100),
        teams: shape.teams,
      }
    : null;
}
