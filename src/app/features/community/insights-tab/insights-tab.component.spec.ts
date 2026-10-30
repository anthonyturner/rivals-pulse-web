import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import { InsightsTabComponent } from './insights-tab.component';

const ready: CommunityInsights = {
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
        { label: 'Monday', status: 'ready', matches: 120, share: 100, winRate: 55 },
        { label: 'Tuesday', status: 'not-enough-data', matches: null, share: null, winRate: null },
      ],
    },
  ],
};

describe('InsightsTabComponent', () => {
  let http: HttpTestingController;

  function render() {
    const fixture = TestBed.createComponent(InsightsTabComponent);
    fixture.detectChanges();

    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading before the answer arrives', () => {
    const { host } = render();

    expect(host.textContent).toContain('Loading');
    http.expectOne('/api/community/insights');
  });

  it('shows the designed empty state when there is not enough data', async () => {
    const { fixture, host } = render();

    http.expectOne('/api/community/insights').flush({ ...ready, status: 'not-enough-data', dimensions: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.textContent).toContain('Not enough data yet');
    expect(host.querySelector('table')).toBeNull();
  });

  it('shows the empty state, not a blank panel, when the request fails', async () => {
    const { fixture, host } = render();

    http.expectOne('/api/community/insights').flush('down', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host.textContent).toContain('Not enough data yet');
  });

  it('shows shown rows with their volume and win rate, and hidden rows as not enough data', async () => {
    const { fixture, host } = render();

    http.expectOne('/api/community/insights').flush(ready);
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = Array.from(host.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .map((cell) => cell.textContent?.trim())
        .join(' | '),
    );
    expect(rows).toEqual(['Monday | 120 | 55.0%', 'Tuesday | Not enough data yet']);
    expect(host.textContent).toContain('All days and times are UTC.');
    expect(host.textContent).toContain('30 minutes without a match');
    expect(host.textContent).not.toContain('NaN');
  });
});
