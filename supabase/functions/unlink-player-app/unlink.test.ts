import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { unlinkPlayerFromApp } from './unlink.ts';

function setup(data: unknown) {
  const { runtime, calls } = testRuntime(() => ({ data, error: null }));
  return { handler: overwolfEndpoint(unlinkPlayerFromApp, runtime), calls };
}

describe('unlink-player-app', () => {
  it('removes the link of the verified session and says so', async () => {
    const { handler, calls } = setup({ status: 'unlinked' });
    const response = await handler(appRequest('POST'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: false, unlinked: true });
    assert.deepEqual(calls, [{
      name: 'unlink_player_for_recorder',
      args: { p_recorder_id: await testRecorder(), p_limit: 10 },
    }]);
  });

  it('answers a session with no link the same way, saying nothing was removed', async () => {
    const { handler } = setup({ status: 'not_linked' });
    const response = await handler(appRequest('DELETE'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: false, unlinked: false });
  });

  it('refuses an unverified session with 401 and changes nothing', async () => {
    for (const session of [null, 'forged']) {
      const { handler, calls } = setup({ status: 'unlinked' });
      const response = await handler(appRequest('POST', { session }));

      assert.equal(response.status, 401, String(session));
      assert.equal(calls.length, 0, String(session));
    }
  });

  it('ignores anything in the body: the recorder is the one the session proves', async () => {
    const { handler, calls } = setup({ status: 'unlinked' });
    await handler(appRequest('POST', { body: { recorderId: 'someone-else', p_recorder_id: 'someone-else', userId: 'x' } }));

    assert.equal(calls[0].args.p_recorder_id, await testRecorder());
    assert.deepEqual(Object.keys(calls[0].args).sort(), ['p_limit', 'p_recorder_id']);
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { handler } = setup({ status: 'rate_limited', retryAfter: 300 });
    const response = await handler(appRequest('POST'));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '300');
  });

  it('answers a database failure with a plain 500 that leaks nothing', async () => {
    const { runtime } = testRuntime(() => ({ data: null, error: { code: 'XX000', message: 'secret internals' } }));
    const response = await overwolfEndpoint(unlinkPlayerFromApp, runtime)(appRequest('POST'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to unlink the player' });
  });

  it('answers POST and DELETE only', async () => {
    const { handler, calls } = setup({ status: 'unlinked' });

    assert.equal((await handler(appRequest('GET'))).status, 405);
    assert.equal((await handler(appRequest('OPTIONS', { session: null }))).status, 200);
    assert.equal(calls.length, 0);
  });
});
