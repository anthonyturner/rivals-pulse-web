import type { HeroStats, HeroStatsModeId } from '../../../contracts/hero-stats.model';

/**
 * Whether Practice is offered as a mode. Off because Practice vs AI uploads the AI bots as real
 * players (anthonyturner/rivals_pulse#1166), which would count bots in the community's numbers.
 * Turn it on once that is fixed and a recorded Practice match stores only human lines.
 */
export const SHOW_PRACTICE_MODE = false;

/** The Quick Match and Competitive blend: what a request with no mode counts. */
export const DEFAULT_MODE_ID: HeroStatsModeId = 'all';

/** Used only when an answer carries no mode list (one the CDN cached before the list existed). */
const DEFAULT_MODE_LABEL = 'Quick Match and Competitive';

export interface ModeOption {
  id: HeroStatsModeId;
  label: string;
}

export interface ModeCandidate extends ModeOption {
  /** True when the mode holds at least one match with a win or a loss in the half-season shown. */
  hasMatches: boolean;
}

/**
 * The modes to offer: those with at least one decided match, so Arcade appears on its own once it
 * has data, and never Practice while `SHOW_PRACTICE_MODE` is off. The mode `selected` stays even
 * with no matches, so a person who chose it can still see its empty state and leave it.
 */
export function selectableModes(candidates: readonly ModeCandidate[], selected: HeroStatsModeId): ModeOption[] {
  return candidates
    .filter(({ id, hasMatches }) => (id !== 'practice' || SHOW_PRACTICE_MODE) && (hasMatches || id === selected))
    .map(({ id, label }) => ({ id, label }));
}

/** The modes a hero stats answer offers, in the answer's order. Empty for an answer without a mode list. */
export function heroStatsModeOptions(stats: HeroStats, selected: HeroStatsModeId): ModeOption[] {
  return selectableModes(
    (stats.modes ?? []).map(({ id, label, decidedMatches }) => ({ id, label, hasMatches: decidedMatches > 0 })),
    selected,
  );
}

/** The name of the mode a hero stats answer counts, such as "Competitive". */
export function modeLabelOf(stats: Pick<HeroStats, 'mode' | 'modes'>): string {
  return stats.modes?.find(({ id }) => id === stats.mode)?.label ?? DEFAULT_MODE_LABEL;
}

/** The mode's name when it is not the default blend, for sentences that only need it then. */
export function nonDefaultModeLabel(stats: Pick<HeroStats, 'mode' | 'modes'>): string | undefined {
  return stats.mode === undefined || stats.mode === DEFAULT_MODE_ID ? undefined : modeLabelOf(stats);
}

/** "in Competitive for Season 10.5": what a count or an empty state is about, so an empty mode names itself. */
export function scopeLabel(modeLabel: string, halfSeasonLabel: string | null): string {
  return `in ${modeLabel}${halfSeasonLabel === null ? '' : ` for ${halfSeasonLabel}`}`;
}

const MODE_CAVEATS: Partial<Record<HeroStatsModeId, string>> = {
  arcade:
    'Arcade has custom lobbies and matches with more than two teams, so its win rates may be wrong. Do not compare them with Quick Match or Competitive.',
  practice:
    'Practice is played against bots, so these numbers are not comparable with Quick Match or Competitive.',
};

/** A warning to show beside a mode whose numbers do not mean what the others do, or null. */
export function modeCaveat(mode: HeroStatsModeId | null | undefined): string | null {
  return (mode === null || mode === undefined ? undefined : MODE_CAVEATS[mode]) ?? null;
}
