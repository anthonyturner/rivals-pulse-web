import { PlatformLocation } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  PROTECTION_BYPASS_HEADER,
  PROTECTION_BYPASS_SECRET,
  protectionBypassInterceptor,
} from './protection-bypass.interceptor';

describe('protectionBypassInterceptor', () => {
  const page = { protocol: 'https:', hostname: 'preview.vercel.app', port: '' };

  function setup(secret: string | undefined) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([protectionBypassInterceptor])),
        provideHttpClientTesting(),
        { provide: PROTECTION_BYPASS_SECRET, useValue: secret },
        { provide: PlatformLocation, useValue: page },
      ],
    });

    return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController) };
  }

  it('sends the secret to the page\'s own origin', () => {
    const { http, backend } = setup('s3cret');

    http.get('https://preview.vercel.app/api/heroes').subscribe();

    expect(backend.expectOne('https://preview.vercel.app/api/heroes').request.headers.get(PROTECTION_BYPASS_HEADER)).toBe(
      's3cret',
    );
  });

  it('never sends the secret to another host, including a look-alike', () => {
    const { http, backend } = setup('s3cret');

    http.get('https://cdn.example.com/api/heroes').subscribe();
    http.get('https://preview.vercel.app.evil.example/api/heroes').subscribe();
    http.get('http://preview.vercel.app/api/heroes').subscribe();

    for (const request of backend.match(() => true)) {
      expect(request.request.headers.has(PROTECTION_BYPASS_HEADER)).toBeFalse();
    }
  });

  it('adds nothing when there is no secret', () => {
    const { http, backend } = setup(undefined);

    http.get('https://preview.vercel.app/api/heroes').subscribe();

    expect(backend.expectOne('https://preview.vercel.app/api/heroes').request.headers.has(PROTECTION_BYPASS_HEADER)).toBeFalse();
  });

  it("sends the secret on a relative address, which is the page's own", () => {
    const { http, backend } = setup('s3cret');

    http.get('/api/heroes').subscribe();

    expect(backend.expectOne('/api/heroes').request.headers.get(PROTECTION_BYPASS_HEADER)).toBe('s3cret');
  });

  it('never sends the secret to a protocol-relative address on another host', () => {
    const { http, backend } = setup('s3cret');

    http.get('//cdn.example.com/api/heroes').subscribe();

    expect(backend.expectOne('//cdn.example.com/api/heroes').request.headers.has(PROTECTION_BYPASS_HEADER)).toBeFalse();
  });
});
