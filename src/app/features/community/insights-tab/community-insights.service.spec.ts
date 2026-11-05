import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import { CommunityInsightsService, isCommunityInsights } from './community-insights.service';

const notEnoughData: CommunityInsights = {
  status: 'not-enough-data',
  timeZone: 'UTC',
  sessionGapMinutes: null,
  minimumMatches: 30,
  minimumRecorders: 3,
  maxRecorderSharePercent: 50,
  dimensions: [],
};

describe('CommunityInsightsService', () => {
  let http: HttpTestingController;
  let service: CommunityInsightsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CommunityInsightsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own community insights and nothing else", () => {
    let result: CommunityInsights | null | undefined;

    service.getInsights().subscribe((insights) => (result = insights));
    http.expectOne('/api/community/insights').flush(notEnoughData);

    expect(result).toEqual(notEnoughData);
  });

  it('answers null when the request fails', () => {
    let result: CommunityInsights | null | undefined;

    service.getInsights().subscribe((insights) => (result = insights));
    http.expectOne('/api/community/insights').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not community insights', () => {
    let result: CommunityInsights | null | undefined;

    service.getInsights().subscribe((insights) => (result = insights));
    http.expectOne('/api/community/insights').flush({ message: 'hello' });

    expect(result).toBeNull();
  });
});

describe('isCommunityInsights', () => {
  it('accepts the designed empty answer', () => {
    expect(isCommunityInsights(notEnoughData)).toBeTrue();
  });

  it('rejects things that are not insights', () => {
    expect(isCommunityInsights(null)).toBeFalse();
    expect(isCommunityInsights('text')).toBeFalse();
    expect(isCommunityInsights({ ...notEnoughData, dimensions: 'no' })).toBeFalse();
    expect(isCommunityInsights({ ...notEnoughData, status: 'maybe' })).toBeFalse();
    expect(isCommunityInsights({ ...notEnoughData, dimensions: [{ id: 'weekday' }] })).toBeFalse();
  });
});
