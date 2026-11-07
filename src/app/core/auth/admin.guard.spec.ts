import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type Route } from '@angular/router';

import { adminGuard } from './admin.guard';
import { AuthService, SessionState } from './auth.service';

const ACCOUNT = { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' };

describe('adminGuard', () => {
  const run = async (session: SessionState): Promise<boolean | UrlTree> => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { state: signal(session), load: () => Promise.resolve(session) } },
      ],
    });

    return (await TestBed.runInInjectionContext(() => adminGuard({} as Route, []))) as boolean | UrlTree;
  };

  it('lets an administrator through', async () => {
    expect(await run({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: true })).toBeTrue();
  });

  it('sends a signed-in visitor who is not an administrator to the home page', async () => {
    const result = await run({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false });

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  for (const status of ['signedOut', 'unavailable', 'loading'] as const) {
    it(`sends a visitor who is ${status} to the home page`, async () => {
      const result = await run({ status });

      expect(result instanceof UrlTree).toBeTrue();
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
    });
  }
});
