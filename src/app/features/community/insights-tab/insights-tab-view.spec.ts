import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import { buildInsightsTabView } from './insights-tab-view';

function insights(overrides: Partial<CommunityInsights> = {}): CommunityInsights {
  return {
    status: 'ready',
    timeZone: 'UTC',
    sessionGapMinutes: 30,
    minimumMatches: 30,
    minimumRecorders: 3,
    dimensions: [
      {
        id: 'weekday',
        title: 'Day of the week',
        buckets: [
          { label: 'Monday', status: 'ready', matches: 1200, share: 60, winRate: 52.34 },
          { label: 'Tuesday', status: 'ready', matches: 600, share: 30, winRate: null },
          { label: 'Wednesday', status: 'not-enough-data', matches: null, share: null, winRate: null },
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

  it('is the empty state when the answer failed or has no shown bucket', () => {
    expect(buildInsightsTabView(null)).toEqual({ kind: 'not-enough-data' });
    expect(buildInsightsTabView(insights({ status: 'not-enough-data' }))).toEqual({ kind: 'not-enough-data' });
  });

  it('writes the volume with thousands separators and the win rate to one decimal', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    const [monday] = view.dimensions[0].rows;
    expect(monday).toEqual(jasmine.objectContaining({ label: 'Monday', ready: true, matches: '1,200', winRate: '52.3%' }));
  });

  it('sizes the bars against the largest shown bucket of the dimension', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.dimensions[0].rows.map((row) => row.barPercent)).toEqual([100, 50, 0]);
  });

  it('says a shown bucket has too few results for a win rate, and a hidden one has too little data', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    const [, tuesday, wednesday] = view.dimensions[0].rows;
    expect(tuesday.winRate).toBe('Not enough results');
    expect(wednesday).toEqual(jasmine.objectContaining({ ready: false, matches: '', winRate: '' }));
  });

  it('states the time zone, the session gap and the minimums', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.notes.join(' ')).toContain('UTC');
    expect(view.notes.join(' ')).toContain('30 minutes');
    expect(view.notes.join(' ')).toContain('30 matches');
    expect(view.notes.join(' ')).toContain('3 players');
  });

  it('leaves the session sentence out when the gap is not known', () => {
    const view = buildInsightsTabView(insights({ sessionGapMinutes: null }));

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.notes.join(' ')).not.toContain('session ends');
  });
});
