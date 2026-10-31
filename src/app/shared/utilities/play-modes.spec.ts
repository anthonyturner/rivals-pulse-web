import type { HeroStats, HeroStatsMode, HeroStatsModeId } from '../../../contracts/hero-stats.model';
import {
  heroStatsModeOptions,
  modeCaveat,
  modeLabelOf,
  nonDefaultModeLabel,
  scopeLabel,
  selectableModes,
  SHOW_PRACTICE_MODE,
} from './play-modes';

const modes: HeroStatsMode[] = [
  { id: 'all', label: 'Quick Match and Competitive', decidedMatches: 173 },
  { id: 'quick-match', label: 'Quick Match', decidedMatches: 145 },
  { id: 'competitive', label: 'Competitive', decidedMatches: 28 },
  { id: 'arcade', label: 'Arcade', decidedMatches: 0 },
  { id: 'practice', label: 'Practice', decidedMatches: 1 },
];

function statsOf(mode: HeroStatsModeId | null, list: HeroStatsMode[] = modes): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [],
    halfSeason: null,
    inPlaceOf: null,
    mode,
    modes: list,
    matchesCounted: 0,
    tiers: [],
    belowMinimum: [],
  };
}

const ids = (stats: HeroStats, selected: HeroStatsModeId = 'all'): string[] =>
  heroStatsModeOptions(stats, selected).map((option) => option.id);

describe('play modes', () => {
  it('keeps Practice off the list until the overlay stops uploading bots as players', () => {
    expect(SHOW_PRACTICE_MODE).withContext('rivals_pulse#1166 is still open').toBeFalse();
    expect(ids(statsOf('all'))).not.toContain('practice');
  });

  it('offers the modes that hold a decided match, in the answer order, and leaves out Arcade while it has none', () => {
    expect(ids(statsOf('all'))).toEqual(['all', 'quick-match', 'competitive']);
  });

  it('offers a mode on its own once it holds a decided match', () => {
    const withArcade = modes.map((mode) => (mode.id === 'arcade' ? { ...mode, decidedMatches: 4 } : mode));

    expect(ids(statsOf('all', withArcade))).toEqual(['all', 'quick-match', 'competitive', 'arcade']);
  });

  it('keeps the chosen mode even when it holds no match, so its empty state can be left', () => {
    const noCompetitive = modes.map((mode) => (mode.id === 'competitive' ? { ...mode, decidedMatches: 0 } : mode));

    expect(ids(statsOf('competitive', noCompetitive), 'competitive')).toEqual(['all', 'quick-match', 'competitive']);
    expect(ids(statsOf('all', noCompetitive))).toEqual(['all', 'quick-match']);
  });

  it('offers nothing for an answer without a mode list', () => {
    const withoutModes: HeroStats = { ...statsOf('all'), modes: undefined };

    expect(heroStatsModeOptions(withoutModes, 'all')).toEqual([]);
  });

  it('selects from any list of candidates, as the role stats do', () => {
    expect(
      selectableModes(
        [
          { id: 'all', label: 'A', hasMatches: true },
          { id: 'arcade', label: 'B', hasMatches: false },
        ],
        'all',
      ),
    ).toEqual([{ id: 'all', label: 'A' }]);
  });

  it('names the mode counted, falling back to the blend for an answer without a mode list', () => {
    expect(modeLabelOf(statsOf('competitive'))).toBe('Competitive');
    expect(modeLabelOf(statsOf('all'))).toBe('Quick Match and Competitive');
    expect(modeLabelOf({ mode: undefined, modes: undefined })).toBe('Quick Match and Competitive');
  });

  it('names a mode for a sentence only when it is not the default blend', () => {
    expect(nonDefaultModeLabel(statsOf('competitive'))).toBe('Competitive');
    expect(nonDefaultModeLabel(statsOf('all'))).toBeUndefined();
    expect(nonDefaultModeLabel({ mode: undefined, modes: undefined })).toBeUndefined();
  });

  it('names the mode and the half-season an empty state is about', () => {
    expect(scopeLabel('Competitive', 'Season 10.5')).toBe('in Competitive for Season 10.5');
    expect(scopeLabel('Competitive', null)).toBe('in Competitive');
  });

  it('warns about Arcade and Practice only', () => {
    expect(modeCaveat('arcade')).toContain('may be wrong');
    expect(modeCaveat('practice')).toContain('against bots');
    expect(modeCaveat('competitive')).toBeNull();
    expect(modeCaveat('all')).toBeNull();
    expect(modeCaveat(null)).toBeNull();
    expect(modeCaveat(undefined)).toBeNull();
  });
});
