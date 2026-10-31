import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import { buildInsightsTabView } from './insights-tab-view';

function insights(overrides: Partial<CommunityInsights> = {}): CommunityInsights {
  return {
    status: 'ready',
    timeZone: 'UTC',
    sessionGapMinutes: 30,
    minimumMatches: 30,
    minimumRecorders: 3,
    maxRecorderSharePercent: 50,
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

  it('writes the share and the win rate as whole percentages', () => {
    const view = buildInsightsTabView(insights());

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    const [monday] = view.dimensions[0].rows;
    expect(monday).toEqual(jasmine.objectContaining({ label: 'Monday', ready: true, share: '60%', winRate: '52%' }));
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
    expect(wednesday).toEqual(jasmine.objectContaining({ ready: false, share: '', winRate: '' }));
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
    expect(view.notes.join(' ')).toContain('more than 50%');
  });

  it('leaves the session sentence out when the gap is not known', () => {
    const view = buildInsightsTabView(insights({ sessionGapMinutes: null }));

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.notes.join(' ')).not.toContain('session ends');
  });
});

describe('buildInsightsTabView gates', () => {
  it('leaves the gate sentence out when they are not known', () => {
    const view = buildInsightsTabView(insights({ minimumMatches: null }));

    if (view.kind !== 'ready') {
      throw new Error('expected a ready view');
    }
    expect(view.notes.join(' ')).not.toContain('players are behind');
  });
});
