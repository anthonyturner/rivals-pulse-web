import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { linkedDashboard } from './own-dashboard.fixtures';

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

    expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false });
    expect(fetchSpy).toHaveBeenCalledOnceWith('/api/auth/session');
  });

  it('is an admin when the server says true', async () => {
    create(answer(200, { signedIn: true, account: ACCOUNT, isAdmin: true }));

    expect(await service.load()).toEqual({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: true });
  });

  for (const claim of ['true', 1, 'admin', {}, null]) {
    it(`is not an admin when the server says ${JSON.stringify(claim)}`, async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT, isAdmin: claim }));

      expect(await service.load()).toEqual(jasmine.objectContaining({ isAdmin: false }));
    });
  }

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

  it('reads the linked player from the session', async () => {
    const player = { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' };
    create(answer(200, { signedIn: true, account: ACCOUNT, player }));

    await service.load();

    expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player, isAdmin: false });
  });

  it('ignores a player the answer does not describe properly', async () => {
    create(answer(200, { signedIn: true, account: ACCOUNT, player: { avatarUrl: 'x' } }));

    await service.load();

    expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false });
  });

  describe('linking', () => {
    const player = { name: 'Aurora', avatarUrl: null };
    const signedIn = () => answer(200, { signedIn: true, account: ACCOUNT, player: null });

    it('posts the typed code and then shows the linked player without asking the session again', async () => {
      create(signedIn(), answer(200, { player }));
      await service.load();

      expect(await service.linkPlayer('abcd-efgh')).toEqual({ status: 'done' });

      expect(fetchSpy.calls.argsFor(1)).toEqual([
        '/api/account/link',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'abcd-efgh' }) },
      ]);
      expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player, isAdmin: false });
      expect(await service.load()).toEqual({ status: 'signedIn', account: ACCOUNT, player, isAdmin: false });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('passes on the server message when the code is refused and changes nothing', async () => {
      create(signedIn(), answer(400, { error: 'That code is wrong or has expired. Get a new one from the desktop app.' }));
      await service.load();

      expect(await service.linkPlayer('nope')).toEqual({
        status: 'failed',
        message: 'That code is wrong or has expired. Get a new one from the desktop app.',
      });
      expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false });
    });

    it('gives a plain message when the answer has no readable error or the network is down', async () => {
      create(signedIn(), answer(500));
      await service.load();

      const unreadable = await service.linkPlayer('abcd-efgh');

      expect(unreadable.status === 'failed' && unreadable.message).toContain('could not be linked');

      fetchSpy.and.rejectWith(new TypeError('offline'));

      expect((await service.linkPlayer('abcd-efgh')).status).toBe('failed');
    });

    it('reports an ended session as signed out', async () => {
      create(signedIn(), answer(401, { error: 'Sign in to link the desktop app.' }));
      await service.load();

      expect(await service.linkPlayer('abcd-efgh')).toEqual({ status: 'signedOut' });
      expect(service.state()).toEqual({ status: 'signedOut' });
    });

    it('unlinks through a POST and shows no player', async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT, player }), answer(200, { player: null }));
      await service.load();

      expect(await service.unlinkPlayer()).toEqual({ status: 'done' });

      expect(fetchSpy.calls.argsFor(1)[0]).toBe('/api/account/unlink');
      expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false });
    });

    it('keeps the player shown when unlinking fails', async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT, player }), answer(503, { error: 'Linking is unavailable right now.' }));
      await service.load();

      expect(await service.unlinkPlayer()).toEqual({ status: 'failed', message: 'Linking is unavailable right now.' });
      expect(service.state()).toEqual({ status: 'signedIn', account: ACCOUNT, player, isAdmin: false });
    });
  });

  describe('the Pulse Records setting', () => {
    it('reads the setting with a plain GET', async () => {
      create(answer(200, { showInRecords: true }));

      expect(await service.loadRecordsOptIn()).toEqual({ status: 'ready', showInRecords: true });
      expect(fetchSpy).toHaveBeenCalledOnceWith('/api/account/records-opt-in');
    });

    for (const show of [true, false]) {
      it(`posts only the choice (${show}) as JSON and returns what the server saved`, async () => {
        create(answer(200, { showInRecords: show }));

        expect(await service.setRecordsOptIn(show)).toEqual({ status: 'ready', showInRecords: show });
        expect(fetchSpy).toHaveBeenCalledOnceWith('/api/account/records-opt-in', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ show }),
        });
      });
    }

    it('reports an ended session as signed out', async () => {
      create(answer(200, { signedIn: true, account: ACCOUNT }), answer(401, { error: 'Sign in to change this setting.' }));
      await service.load();

      expect(await service.setRecordsOptIn(true)).toEqual({ status: 'signedOut' });
      expect(service.state()).toEqual({ status: 'signedOut' });
    });

    it('passes on the reason the server gives, such as needing a link first', async () => {
      create(answer(409, { error: 'Link the desktop app first.' }));

      expect(await service.setRecordsOptIn(true)).toEqual({ status: 'failed', message: 'Link the desktop app first.' });
    });

    it('gives a plain message, and never an "off", when the answer is unreadable or the network is down', async () => {
      create(answer(500), answer(200, { showInRecords: 'yes' }));

      const read = await service.loadRecordsOptIn();
      const odd = await service.loadRecordsOptIn();

      expect(read.status === 'failed' && read.message).toContain('could not be loaded');
      expect(odd.status).toBe('failed');

      fetchSpy.and.rejectWith(new TypeError('offline'));

      const saved = await service.setRecordsOptIn(false);

      expect(saved.status === 'failed' && saved.message).toContain('could not be saved');
    });
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

    it('asks for a fresh sign-in, keeping the visitor signed in, when the last one is too old', async () => {
      create(
        answer(200, { signedIn: true, account: ACCOUNT }),
        answer(401, { error: 'Sign in again.', reason: 'recent-sign-in-required' }),
      );
      await service.load();

      expect(await service.deleteAccount(asked)).toEqual({ status: 'signInAgain' });
      expect(service.state().status).toBe('signedIn');
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
      expect(result.status === 'failed' && result.message).toContain('did not go through');
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

describe('AuthService.loadDashboard', () => {
  let service: AuthService;

  const create = (response: Response | Error): jasmine.Spy => {
    const spy = spyOn(window, 'fetch');

    if (response instanceof Error) {
      spy.and.rejectWith(response);
    } else {
      spy.and.resolveTo(response);
    }

    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(AuthService);

    return spy;
  };

  it('reads the signed-in player from the dashboard route', async () => {
    const body = linkedDashboard();
    const fetchSpy = create(answer(200, body));

    expect(await service.loadDashboard()).toEqual({ status: 'ready', dashboard: body });
    expect(fetchSpy).toHaveBeenCalledOnceWith('/api/account/dashboard');
  });

  it('passes on an account with no link', async () => {
    create(answer(200, { linked: false }));

    expect(await service.loadDashboard()).toEqual({ status: 'ready', dashboard: { linked: false } });
  });

  it('reports an ended session as signed out and remembers it', async () => {
    create(answer(401, { error: 'Your session has ended.' }));

    expect(await service.loadDashboard()).toEqual({ status: 'signedOut' });
    expect(service.state()).toEqual({ status: 'signedOut' });
  });

  it('is unavailable, keeping the visitor signed in, when the server cannot read the stats', async () => {
    create(answer(503, { error: 'down' }));

    expect(await service.loadDashboard()).toEqual({ status: 'unavailable' });
    expect(service.state()).toEqual({ status: 'loading' });
  });

  it('is unavailable for an answer that is not a dashboard', async () => {
    create(answer(200, { unexpected: true }));

    expect(await service.loadDashboard()).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the network is down', async () => {
    create(new TypeError('offline'));

    expect(await service.loadDashboard()).toEqual({ status: 'unavailable' });
  });
});
