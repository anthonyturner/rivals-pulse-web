import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { refreshLinkedPlayer } from './refresh.ts';

const body = { playerName: ' Aurora ', avatarUrl: 'https://content.overwolf.com/a.png' };

function setup(status: string, retryAfter?: number) {
  const { runtime, calls } = testRuntime(() => ({ data: { status, retryAfter }, error: null }));
  return { handler: overwolfEndpoint(refreshLinkedPlayer, runtime), calls };
}

describe('refresh-linked-player', () => {
  it('refreshes the link of the verified session and says so', async () => {
    const { handler, calls } = setup('refreshed');
    const response = await handler(appRequest('POST', { body }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: true, playerName: 'Aurora' });
    assert.deepEqual(calls, [{
      name: 'refresh_linked_player',
      args: {
        p_recorder_id: await testRecorder(),
        p_player_name: 'Aurora',
        p_avatar_url: 'https://content.overwolf.com/a.png',
        p_limit: 30,
      },
    }]);
  });

  it('answers a session with no link as a no-op', async () => {
    const { handler } = setup('not_linked');
    const response = await handler(appRequest('POST', { body }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: false });
  });

  it('sends no avatar when the address is not an allowed one, and a cleaned, capped name', async () => {
    const { handler, calls } = setup('refreshed');
    await handler(appRequest('POST', {
      body: { playerName: `Au\u202Ero${'x'.repeat(100)}`, avatarUrl: 'https://evil.example/a.png' },
    }));

    assert.equal(calls[0].args.p_avatar_url, null);
    assert.equal(Array.from(String(calls[0].args.p_player_name)).length, 64);
    assert.ok(String(calls[0].args.p_player_name).startsWith('Auro'));
  });

  it('never passes a uid on, even when the body carries one', async () => {
    const { handler, calls } = setup('refreshed');
    await handler(appRequest('POST', { body: { ...body, playerUid: '999', player_uid: '999' } }));

    assert.deepEqual(Object.keys(calls[0].args).sort(), ['p_avatar_url', 'p_limit', 'p_player_name', 'p_recorder_id']);
  });

  it('refuses an unverified session with 401 and touches nothing', async () => {
    for (const session of [null, 'forged']) {
      const { handler, calls } = setup('refreshed');
      const response = await handler(appRequest('POST', { session, body }));

      assert.equal(response.status, 401, String(session));
      assert.equal(calls.length, 0, String(session));
    }
  });

  it('asks for a name when there is none, and writes nothing', async () => {
    for (const bad of [{}, { playerName: '   ' }, { avatarUrl: 'https://content.overwolf.com/a.png' }]) {
      const { handler, calls } = setup('refreshed');
      const response = await handler(appRequest('POST', { body: bad }));

      assert.equal(response.status, 422);
      assert.equal((await response.json()).reason, 'no-player');
      assert.equal(calls.length, 0);
    }
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { handler } = setup('rate_limited', 120);
    const response = await handler(appRequest('POST', { body }));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '120');
    assert.equal((await response.json()).retryAfter, 120);
  });

  it('answers an unrecognised database answer with a plain 500, not as an unlinked session', async () => {
    const unrecognised = [null, 'refreshed', {}, { status: 'surprise' }, { status: 'rate_limited' }];

    for (const data of unrecognised) {
      const { runtime } = testRuntime(() => ({ data, error: null }));
      const response = await overwolfEndpoint(refreshLinkedPlayer, runtime)(appRequest('POST', { body }));

      assert.equal(response.status, 500, JSON.stringify(data));
      assert.deepEqual(await response.json(), { error: 'Unable to refresh the linked player' });
    }
  });

  it('answers a database failure with a plain 500 that leaks nothing', async () => {
    const { runtime } = testRuntime(() => ({ data: null, error: { code: 'XX000', message: 'secret internals' } }));
    const response = await overwolfEndpoint(refreshLinkedPlayer, runtime)(appRequest('POST', { body }));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to refresh the linked player' });
  });

  it('answers only POST, plus the CORS preflight', async () => {
    const { handler, calls } = setup('refreshed');

    assert.equal((await handler(appRequest('GET'))).status, 405);
    const preflight = await handler(appRequest('OPTIONS', { session: null }));
    assert.equal(preflight.status, 200);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers') ?? '', /x-overwolf-session/);
    assert.equal(calls.length, 0);
  });
});
