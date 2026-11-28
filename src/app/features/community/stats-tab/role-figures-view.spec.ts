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

  it('is a card per role, with a missing figure said in words and never as a zero', () => {
    const view = buildRoleFiguresView(READY, 'all');
    const figures = view.kind === 'ready' ? view.cards.map((card) => [card.role, card.bars.map((bar) => bar.value)]) : [];

    expect(view.kind).toBe('ready');
    expect(figures).toEqual([
      ['Vanguard', ['1,234', '0', '4,821']],
      ['Duelist', ['987', 'Not enough data', 'Not enough data']],
      ['Strategist', ['Not enough data', '640', 'Not enough data']],
    ]);
    expect(view.kind === 'ready' && view.cards.map((card) => card.roleKey)).toEqual(['vanguard', 'duelist', 'strategist']);
    expect(view.kind === 'ready' && view.cards[0].bars.map((bar) => bar.label)).toEqual(['Damage', 'Healing', 'Damage blocked']);
    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10.5');
    expect(view.kind === 'ready' && view.notice).toBeNull();
    expect(view.kind === 'ready' && view.note).toContain('describes those players, not everyone in a lobby');
  });

  it('scales each figure to the largest role, so the cards compare roles and a missing figure has no bar', () => {
    const view = buildRoleFiguresView(READY, 'all');
    const percents = view.kind === 'ready' ? view.cards.map((card) => card.bars.map((bar) => bar.percent)) : [];

    expect(percents[0]?.[0]).toBe(100);
    expect(percents[1]?.[0]).toBeCloseTo((987 / 1234) * 100);
    expect(percents[0]).toEqual([100, 0, 100]);
    expect(percents[1]).toEqual([jasmine.any(Number), null, null]);
    expect(percents[2]).toEqual([null, 100, null]);
  });

  it('gives a figure that every role reports as zero an empty bar, never NaN', () => {
    const zero = figuresOf({ Vanguard: { damage: 0 }, Duelist: { damage: 0 }, Strategist: { damage: 0 } }, [heroFigures('hela', { damage: 1 })]);
    const view = buildRoleFiguresView(zero, 'all');

    expect(view.kind === 'ready' && view.cards.map((card) => card.bars[0].percent)).toEqual([0, 0, 0]);
  });

  it('is the designed empty state, naming the line and player minimums, when nothing clears them', () => {
    const view = buildRoleFiguresView(emptyFigures(), 'all');

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('50 lines');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('at least 2 different players');
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

    expect(chosen.kind === 'ready' && chosen.cards[0].bars[0].value).toBe('1,500');
    expect(unknown.kind === 'ready' && unknown.cards[0].bars[0].value).toBe('1,234');
  });

  it('says the previous half-season stands in', () => {
    const view = buildRoleFiguresView({ ...READY, halfSeason: season(10), inPlaceOf: season(10.5) }, 'all');

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });

  it('prints no NaN, undefined or null', () => {
    const view = buildRoleFiguresView(READY, 'all');
    const text = view.kind === 'ready' ? JSON.stringify(view.cards.map((card) => card.bars.map((bar) => [bar.label, bar.value]))) : '';

    expect(text).not.toBe('');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });
});
