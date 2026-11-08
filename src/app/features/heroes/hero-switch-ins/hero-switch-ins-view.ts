import type { HeroSwitchIn, HeroSwitchIns } from '../../../../contracts/hero-switch-ins.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import type { RosterHero } from '../../insights/hero-matchup-records';

/** One hero in a switch-in list, with the figures and the sentence its row shows. */
export interface SwitchInRow {
  /** The hero the row pictures: the enemy in the first list, the hero switched to in the second. */
  hero: RosterHero;
  /** How often the switching team won, such as `42.9%`. */
  winRate: string;
  /** The sample behind it, such as `14 switches in 12 matches`. */
  sample: string;
  /** The hero's overall record against that enemy, or why there is none to compare. */
  overall: string;
  /** The whole row in words, for its tooltip. */
  description: string;
}

export type HeroSwitchInsView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'not-enough-data';
      /** The designed empty state: what to wait for, with the minimums the server states. */
      summary: string;
    }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when this is the previous half-season. */
      notice: string | null;
      /** Switches to this hero, by the enemy hero on the field. */
      switchedTo: SwitchInRow[];
      /** Heroes switched to against this hero. */
      switchedAgainst: SwitchInRow[];
    };

/**
 * What a hero page shows for one hero's switch-ins. `undefined` means they have not answered yet and
 * `null` means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroSwitchInsView(
  switchIns: HeroSwitchIns | null | undefined,
  heroId: string,
  roster: readonly RosterHero[],
): HeroSwitchInsView {
  if (switchIns === undefined) {
    return { kind: 'loading' };
  }

  if (switchIns === null) {
    return { kind: 'unavailable' };
  }

  const byId = new Map(roster.map((hero) => [hero.id, hero]));
  const switchedTo = rowsOf(switchIns.switchIns.filter((line) => line.hero === heroId), 'enemy', byId);
  const switchedAgainst = rowsOf(switchIns.switchIns.filter((line) => line.enemy === heroId), 'hero', byId);

  if (switchedTo.length === 0 && switchedAgainst.length === 0) {
    return {
      kind: 'not-enough-data',
      summary:
        'No switch-ins recorded yet. This fills in once RivalsPulse overlays send hero switches and a pairing reaches ' +
        `${switchIns.minimumMatches} matches from ${switchIns.minimumPlayers} players.`,
    };
  }

  const halfSeasonLabel = switchIns.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: switchIns.inPlaceOf === null ? null : halfSeasonFallbackNotice(switchIns.inPlaceOf.label, halfSeasonLabel),
    switchedTo,
    switchedAgainst,
  };
}

/**
 * Turns switch-ins into rows, largest sample first and then by hero name, so the order says how much
 * a row rests on and never which switch is best. A row naming a hero the roster does not know is left
 * out rather than shown half-blank.
 */
function rowsOf(
  lines: readonly HeroSwitchIn[],
  shown: 'hero' | 'enemy',
  byId: ReadonlyMap<string, RosterHero>,
): SwitchInRow[] {
  const rows = lines.flatMap((line) => {
    const portrait = byId.get(line[shown]);
    const switchedTo = byId.get(line.hero);
    const enemy = byId.get(line.enemy);

    return portrait === undefined || switchedTo === undefined || enemy === undefined
      ? []
      : [{ matches: line.matches, row: rowOf(line, portrait, switchedTo, enemy) }];
  });

  return rows
    .sort((a, b) => b.matches - a.matches || a.row.hero.name.localeCompare(b.row.hero.name))
    .map(({ row }) => row);
}

function rowOf(line: HeroSwitchIn, portrait: RosterHero, switchedTo: RosterHero, enemy: RosterHero): SwitchInRow {
  const winRate = percentLabel(line.winRate);
  const sample = `${countLabel(line.switches, 'switch', 'switches')} in ${countLabel(line.matches, 'match', 'matches')}`;
  const overall =
    line.overall === null
      ? `No overall record against ${enemy.name} to compare`
      : `Overall ${percentLabel(line.overall.winRate)} in ${countLabel(line.overall.matches, 'match', 'matches')}`;
  const comparison =
    line.overall === null
      ? `${switchedTo.name} has no overall record against ${enemy.name} to compare with yet.`
      : `${switchedTo.name} wins ${percentLabel(line.overall.winRate)} of ${countLabel(line.overall.appearances, 'game', 'games')} against ${enemy.name} overall.`;

  return {
    hero: portrait,
    winRate,
    sample,
    overall,
    description:
      `Players switched to ${switchedTo.name} ${countLabel(line.switches, 'time', 'times')} while ${enemy.name} was on the other team ` +
      `and won ${line.wins} (${winRate}) in ${countLabel(line.matches, 'match', 'matches')}. ${comparison}`,
  };
}
