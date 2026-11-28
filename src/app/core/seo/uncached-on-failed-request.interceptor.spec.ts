import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RESPONSE_INIT, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  FAILED_RENDER_CACHE_CONTROL,
  uncachedOnFailedRequestInterceptor,
} from './uncached-on-failed-request.interceptor';

describe('uncachedOnFailedRequestInterceptor', () => {
  function setup(response: ResponseInit | null) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([uncachedOnFailedRequestInterceptor])),
        provideHttpClientTesting(),
        { provide: RESPONSE_INIT, useValue: response },
      ],
    });

    return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController) };
  }

  it('marks the response uncacheable when a request fails', () => {
    const response: ResponseInit = { headers: new Headers({ 'content-type': 'text/html' }) };
    const { http, backend } = setup(response);

    http.get('/api/heroes').subscribe({ error: () => undefined });
    backend.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });

    expect(new Headers(response.headers).get('cache-control')).toBe(FAILED_RENDER_CACHE_CONTROL);
  });

  it('leaves the response alone when every request succeeds', () => {
    const response: ResponseInit = { headers: new Headers() };
    const { http, backend } = setup(response);

    http.get('/api/heroes').subscribe();
    backend.expectOne('/api/heroes').flush([]);

    expect(new Headers(response.headers).has('cache-control')).toBeFalse();
  });

  it('still reports the failure to the caller', () => {
    const { http, backend } = setup({ headers: new Headers() });
    let status = 0;

    http.get('/api/heroes').subscribe({ error: (error) => (status = error.status) });
    backend.expectOne('/api/heroes').flush('down', { status: 503, statusText: 'Unavailable' });

    expect(status).toBe(503);
  });

  it('does nothing without a response to change, as in the browser', () => {
    const { http, backend } = setup(null);

    http.get('/api/heroes').subscribe({ error: () => undefined });

    expect(() => backend.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' })).not.toThrow();
  });
});
