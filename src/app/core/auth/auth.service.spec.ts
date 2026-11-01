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

  describe('deleteAccount', () => {
    const asked = { mode: 'account', confirmation: 'delete my account' } as const;

    it('posts the choice and the typed phrase as JSON, then shows the visitor as signed out', async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT }), answer(200, { deleted: true }));
      await service.load();

      const result = await service.deleteAccount(asked);

      expect(result).toEqual({ status: 'deleted' });
      expect(fetchSpy.calls.argsFor(1)).toEqual([
        '/api/account/delete',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(asked) },
      ]);
      expect(service.state()).toEqual({ status: 'signedOut' });
      expect(await service.load()).toEqual({ status: 'signedOut' });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('reports an ended session as signed out, not as a failure', async () => {
      create(answer(401, { error: 'Your session has ended.' }));

      expect(await service.deleteAccount(asked)).toEqual({ status: 'signedOut' });
      expect(service.state()).toEqual({ status: 'signedOut' });
    });

    it('keeps the visitor signed in and passes on the server message when it refuses', async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT }), answer(503, { error: 'Try again in a moment.' }));
      await service.load();

      expect(await service.deleteAccount(asked)).toEqual({ status: 'failed', message: 'Try again in a moment.' });
      expect(service.state().status).toBe('signedIn');
    });

    it('gives a plain message when the answer has no readable error', async () => {
      create(answer(500));

      const result = await service.deleteAccount(asked);

      expect(result.status).toBe('failed');
      expect(result.status === 'failed' && result.message).toContain('Nothing was removed');
    });

    it('fails without signing the visitor out when the network is down', async () => {
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
      fetchSpy = spyOn(window, 'fetch').and.rejectWith(new TypeError('offline'));
      service = TestBed.inject(AuthService);

      expect((await service.deleteAccount(asked)).status).toBe('failed');
      expect(service.state()).toEqual({ status: 'loading' });
    });
  });
});
