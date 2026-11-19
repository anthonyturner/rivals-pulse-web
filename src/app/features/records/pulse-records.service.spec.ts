import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { recordRows, recordsOf } from './pulse-records.fixtures';
import { isPulseRecords, PulseRecordsService } from './pulse-records.service';

describe('PulseRecordsService', () => {
  let http: HttpTestingController;
  let service: PulseRecordsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PulseRecordsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('returns the boards of /api/records', () => {
    const answer = recordsOf({ kills: recordRows(5) });
    let result: unknown;

    service.getPulseRecords().subscribe((records) => (result = records));
    http.expectOne('/api/records').flush(answer);

    expect(result).toEqual(answer);
  });

  it('asks again on every call, so a name that was switched off cannot linger here', () => {
    service.getPulseRecords().subscribe();
    http.expectOne('/api/records').flush(recordsOf({}));
    service.getPulseRecords().subscribe();
    http.expectOne('/api/records').flush(recordsOf({}));
  });

  it('returns null when the request fails', () => {
    let result: unknown = 'unset';

    service.getPulseRecords().subscribe((records) => (result = records));
    http.expectOne('/api/records').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('returns null for an answer that is not Pulse Records', () => {
    let result: unknown = 'unset';

    service.getPulseRecords().subscribe((records) => (result = records));
    http.expectOne('/api/records').flush({ status: 'ready' });

    expect(result).toBeNull();
  });
});

describe('isPulseRecords', () => {
  it('needs all six boards, so a page never has to guess', () => {
    const answer = recordsOf({});

    expect(isPulseRecords(answer)).toBeTrue();
    expect(isPulseRecords({ ...answer, categories: answer.categories.slice(1) })).toBeFalse();
  });

  it('rejects a row with a figure that is not a number or a name that is not text', () => {
    const rows = (row: unknown) => ({ ...recordsOf({}), categories: recordsOf({}).categories.map((c, i) => (i === 0 ? { ...c, rows: [row] } : c)) });

    expect(isPulseRecords(rows({ heroId: 1, hero: null, value: 3, name: null }))).toBeTrue();
    expect(isPulseRecords(rows({ heroId: 1, hero: null, value: '3', name: null }))).toBeFalse();
    expect(isPulseRecords(rows({ heroId: 1, hero: null, value: 3, name: 7 }))).toBeFalse();
    expect(isPulseRecords(rows({ heroId: 1, value: 3, name: null }))).toBeFalse();
  });
});
