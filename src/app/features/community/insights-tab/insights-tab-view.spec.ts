import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import { buildInsightsTabView, type InsightsDimensionView } from './insights-tab-view';

function insights(overrides: Partial<CommunityInsights> = {}): CommunityInsights {
  return {
    status: 'ready',
    timeZone: 'UTC',
    sessionGapMinutes: 30,
    minimumMatches: 10,
    dimensions: [
      {
        id: 'weekday',
        title: 'Day of the week',
        buckets: [
          { label: 'Monday', status: 'ready', share: 60, winRate: 52 },
          { label: 'Tuesday', status: 'ready', share: 30, winRate: null },
          { label: 'Wednesday', status: 'not-enough-data', share: null, winRate: null },
        ],
      },
    ],
    ...overrides,
  };
}

describe('buildInsightsTabView', () => {
  it('is loading until the answer arrives', () => {
    expect(buildInsightsTabView(undefined)).toEqual({ kind: 'loading' });
  });

  it('is unavailable, not the empty state, when the request failed', () => {
    expect(buildInsightsTabView(null)).toEqual({ kind: 'unavailable' });
  });

  it('is the empty state when the answer has no shown bucket', () => {
    expect(buildInsightsTabView(insights({ status: 'not-enough-data' }))).toEqual({ kind: 'not-enough-data' });
  });

  function dimensionOf(view: ReturnType<typeof buildInsightsTabView>): InsightsDimensionView {
    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }

    return view.dimensions[0];
  }

  it('writes the share and the win rate as whole percentages, in a bar lane and a dot lane', () => {
    const dimension = dimensionOf(buildInsightsTabView(insights()));

    expect(dimension.lanes.map((lane) => [lane.name, lane.kind])).toEqual([
      ['Share of matches', 'bars'],
      ['Win rate', 'dots'],
    ]);
    expect(dimension.columns[0].label).toBe('Monday');
    expect(dimension.columns[0].cells.map((cell) => cell?.valueLabel)).toEqual(['60%', '52%']);
  });

  it('sizes the bars against the largest shown bucket of the dimension', () => {
    const dimension = dimensionOf(buildInsightsTabView(insights()));

    expect(dimension.columns.map((column) => column.cells[0]?.position ?? null)).toEqual([100, 50, null]);
  });

  it('puts the dots in a window around the data and the 50% line, and says which side of the line each is on', () => {
    const view = insights({
      dimensions: [
        {
          id: 'weekday',
          title: 'Day of the week',
          buckets: [
            { label: 'Monday', status: 'ready', share: 50, winRate: 38 },
            { label: 'Tuesday', status: 'ready', share: 30, winRate: 50 },
            { label: 'Wednesday', status: 'ready', share: 20, winRate: 61 },
          ],
        },
      ],
    });
    const dimension = dimensionOf(buildInsightsTabView(view));
    const winRate = dimension.lanes[1];
    const dots = dimension.columns.map((column) => column.cells[1]);

    expect(winRate.note).toBe('Scale 35% to 65%');
    expect(winRate.guide).toEqual({ position: 50, label: '50%' });
    expect(dots.map((cell) => cell?.side)).toEqual(['below', 'even', 'above']);
    expect(dots[0]?.position).toBeCloseTo(10);
    expect(dots[2]?.position).toBeCloseTo(86.67, 1);
  });

  it('says a shown bucket has too few results for a win rate, and a hidden one has no mark at all', () => {
    const dimension = dimensionOf(buildInsightsTabView(insights()));
    const [, tuesday, wednesday] = dimension.columns;

    expect(tuesday.cells[1]).toEqual({ position: null, valueLabel: 'Not enough results' });
    expect(wednesday.cells).toEqual([null, null]);
  });

  it('gives the window of the 50% line alone when no bucket has a win rate', () => {
    const view = insights({
      dimensions: [{ id: 'weekday', title: 'Day', buckets: [{ label: 'Monday', status: 'ready', share: 10, winRate: null }] }],
    });

    expect(dimensionOf(buildInsightsTabView(view)).lanes[1].note).toBe('Scale 45% to 55%');
  });

  it('shortens the axis labels: three letters for a day, the hours of a block, the number of a match', () => {
    const view = insights({
      dimensions: [
        { id: 'weekday', title: 'Day', buckets: [{ label: 'Wednesday', status: 'ready', share: 10, winRate: 50 }] },
        { id: 'time-of-day', title: 'Time', buckets: [{ label: '20:00 to 23:59', status: 'ready', share: 10, winRate: 50 }] },
        {
          id: 'session',
          title: 'Place',
          buckets: [
            { label: 'Match 1', status: 'ready', share: 10, winRate: 50 },
            { label: 'Match 4 or later', status: 'ready', share: 10, winRate: 50 },
          ],
        },
      ],
    });
    const built = buildInsightsTabView(view);

    expect(built.kind === 'ready' && built.dimensions.map((dimension) => dimension.columns.map((column) => column.shortLabel))).toEqual([
      ['Wed'],
      ['20-24'],
      ['1', '4+'],
    ]);
  });

  it('prints a figure over each mark only while the columns are few enough to fit them', () => {
    const buckets = Array.from({ length: 8 }, (_, index) => ({ label: `Match ${index + 1}`, status: 'ready' as const, share: 10, winRate: 50 }));

    expect(dimensionOf(buildInsightsTabView(insights())).showValues).toBeTrue();
    expect(dimensionOf(buildInsightsTabView(insights({ dimensions: [{ id: 'session', title: 'Place', buckets }] }))).showValues).toBeFalse();
  });

  it('states the time zone, the session gap and the minimums', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.note).toContain('UTC');
    expect(view.note).toContain('30 minutes');
    expect(view.note).toContain('10 matches');
    expect(view.note).toContain('one player');
  });

  it('leaves the session sentence out when the gap is not known', () => {
    const view = buildInsightsTabView(insights({ sessionGapMinutes: null }));

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.note).not.toContain('session ends');
  });
});

describe('buildInsightsTabView gates', () => {
  it('leaves the gate sentence out when they are not known', () => {
    const view = buildInsightsTabView(insights({ minimumMatches: null }));

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.note).not.toContain('players are behind');
  });
});
