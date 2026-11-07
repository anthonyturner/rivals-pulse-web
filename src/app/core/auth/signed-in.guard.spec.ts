import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type RouterStateSnapshot } from '@angular/router';

import { AuthService, SessionState } from './auth.service';
import { signedInGuard } from './signed-in.guard';

describe('signedInGuard', () => {
  const run = async (session: SessionState, url = '/account'): Promise<boolean | UrlTree> => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { state: signal(session), load: () => Promise.resolve(session) } },
      ],
    });

    return (await TestBed.runInInjectionContext(() =>
      signedInGuard({} as never, { url } as RouterStateSnapshot),
    )) as boolean | UrlTree;
  };

  it('lets a signed-in visitor through', async () => {
    const result = await run({
      status: 'signedIn',
      account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
      player: null,
      isAdmin: false,
    });

    expect(result).toBeTrue();
  });

  for (const status of ['signedOut', 'unavailable'] as const) {
    it(`sends a visitor who is ${status} to sign-in and back`, async () => {
      const result = await run({ status });

      expect(result instanceof UrlTree).toBeTrue();
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/sign-in?next=%2Faccount');
    });
  }
});
