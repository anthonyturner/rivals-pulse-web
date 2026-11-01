import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

const ACCOUNT = { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

describe('AuthService', () => {
  let service: AuthService;
  let fetchSpy: jasmine.Spy;

  const create = (...responses: Response[]): void => {
    fetchSpy = spyOn(window, 'fetch').and.returnValues(...responses.map((response) => Promise.resolve(response)));
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(AuthService);
  };

  it('starts out loading', () => {
    create();

    expect(service.state()).toEqual({ status: 'loading' });
  });

  it('reads the session from the server once and shares the answer', async () => {
    create(answer(200, { signedIn: true, account: ACCOUNT }));

    await Promise.all([service.load(), service.load()]);

    expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT });
    expect(fetchSpy).toHaveBeenCalledOnceWith('/api/auth/session');
  });

  it('is signed out when the server says so', async () => {
    create(answer(200, { signedIn: false }));

    expect(await service.load()).toEqual({ status: 'signedOut' });
  });

  it('is unavailable, not signed in, when the session cannot be read', async () => {
    create(answer(503, { error: 'down' }));

    expect((await service.load()).status).toBe('unavailable');
  });

  it('treats a signed-in answer without an account as signed out', async () => {
    create(answer(200, { signedIn: true }));

    expect((await service.load()).status).toBe('signedOut');
  });

  it('signs out through a POST and shows the visitor as signed out', async () => {
    create(answer(200, { signedIn: true, account: ACCOUNT }), answer(200, { signedIn: false }));
    await service.load();

    await service.signOut();

    expect(fetchSpy.calls.argsFor(1)).toEqual(['/api/auth/sign-out', { method: 'POST' }]);
    expect(service.state()).toEqual({ status: 'signedOut' });
  });

  it('asks the server again when sign-out fails, since the cookie may survive', async () => {
    create(
      answer(200, { signedIn: true, account: ACCOUNT }),
      answer(500, { error: 'boom' }),
      answer(200, { signedIn: true, account: ACCOUNT }),
    );
    await service.load();

    await service.signOut();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(service.state().status).toBe('signedIn');
  });
});
