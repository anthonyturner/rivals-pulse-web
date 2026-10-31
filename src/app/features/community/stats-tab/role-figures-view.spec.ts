import { emptyFigures, figuresOf, heroFigures } from '../../insights/community-extended.fixtures';
import { season } from '../../insights/hero-matchup.fixtures';
import { buildRoleFiguresView, hasPerMinute, perMinuteLabel } from './role-figures-view';

const READY = figuresOf(
  { Vanguard: { damage: 1234, healing: 0, blocked: 4821 }, Duelist: { damage: 987 }, Strategist: { healing: 640 } },
  [heroFigures('hela', { damage: 990 })],
);

describe('perMinuteLabel', () => {
  it('writes a whole figure with a thousands separator and says so for one that is not shown', () => {
    expect(perMinuteLabel(1234)).toBe('1,234');
    expect(perMinuteLabel(0)).toBe('0');
    expect(perMinuteLabel(null)).toBe('Not enough data');
    expect(perMinuteLabel(Number.NaN)).toBe('Not enough data');
    expect(perMinuteLabel(Number.POSITIVE_INFINITY)).toBe('Not enough data');
  });

  it('tells a set with a figure from one without', () => {
    expect(hasPerMinute({ damage: null, healing: 0, blocked: null })).toBeTrue();
    expect(hasPerMinute({ damage: null, healing: null, blocked: null })).toBeFalse();
  });
});

describe('buildRoleFiguresView', () => {
  it('is loading before the answer and unavailable when it could not be read', () => {
    expect(buildRoleFiguresView(undefined, 'all')).toEqual({ kind: 'loading' });
    expect(buildRoleFiguresView(null, 'all')).toEqual({ kind: 'unavailable' });
  });

  it('is a row per role, with a missing figure said in words and never as a zero', () => {
    const view = buildRoleFiguresView(READY, 'all');

    expect(view.kind).toBe('ready');
    expect(view.kind === 'ready' && view.rows).toEqual([
      { role: 'Vanguard', damage: '1,234', healing: '0', blocked: '4,821' },
      { role: 'Duelist', damage: '987', healing: 'Not enough data', blocked: 'Not enough data' },
      { role: 'Strategist', damage: 'Not enough data', healing: '640', blocked: 'Not enough data' },
    ]);
    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10.5');
    expect(view.kind === 'ready' && view.notice).toBeNull();
    expect(view.kind === 'ready' && view.note).toContain('describes those players, not everyone in a lobby');
  });

  it('is the designed empty state, naming the line and player minimums, when nothing clears them', () => {
    const view = buildRoleFiguresView(emptyFigures(), 'all');

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('50 lines');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('at least 3 different players');
    expect(view.kind === 'not-enough-data' && view.summary).not.toContain(' in ');
  });

  it('names the mode in the empty state of a mode with no figure while another has some', () => {
    const view = buildRoleFiguresView(READY, 'arcade');

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('in Arcade');
  });

  it('shows the selected mode, and the blend for a mode the answer lacks', () => {
    const competitive = figuresOf({}, [], {}, {
      competitive: {
        roles: [{ role: 'Vanguard', damage: 1500, healing: null, blocked: null }],
        heroes: [],
      },
    });

    const chosen = buildRoleFiguresView(competitive, 'competitive');
    const unknown = buildRoleFiguresView(READY, 'unknown-mode' as never);

    expect(chosen.kind === 'ready' && chosen.rows[0].damage).toBe('1,500');
    expect(unknown.kind === 'ready' && unknown.rows[0].damage).toBe('1,234');
  });

  it('says the previous half-season stands in', () => {
    const view = buildRoleFiguresView({ ...READY, halfSeason: season(10), inPlaceOf: season(10.5) }, 'all');

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });

  it('prints no NaN, undefined or null', () => {
    const view = buildRoleFiguresView(READY, 'all');
    const text = view.kind === 'ready' ? JSON.stringify(view.rows) : '';

    expect(text).not.toBe('');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });
});
