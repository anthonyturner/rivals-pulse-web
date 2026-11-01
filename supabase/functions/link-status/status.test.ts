import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { linkStatus } from './status.ts';

function setup(data: unknown) {
  const { runtime, calls } = testRuntime(() => ({ data, error: null }));
  return { handler: overwolfEndpoint(linkStatus, runtime), calls };
}

describe('link-status', () => {
  it('tells a linked session who it is linked as and since when', async () => {
    const { handler, calls } = setup({ status: 'linked', playerName: 'Aurora', linkedAt: '2026-11-01T10:00:00+00:00' });
    const response = await handler(appRequest('GET'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: true, playerName: 'Aurora', linkedAt: '2026-11-01T10:00:00+00:00' });
    assert.deepEqual(calls, [{
      name: 'link_status_for_recorder',
      args: { p_recorder_id: await testRecorder(), p_limit: 60 },
    }]);
  });

  it('tells an unlinked session so, with nothing else', async () => {
    const { handler } = setup({ status: 'not_linked' });
    const response = await handler(appRequest('POST'));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { linked: false });
  });

  it('never returns the website account, even if the database were to send it', async () => {
    const { handler } = setup({
      status: 'linked',
      playerName: 'Aurora',
      linkedAt: '2026-11-01T10:00:00+00:00',
      userId: '7d1c0000-0000-0000-0000-000000000000',
      user_id: '7d1c0000-0000-0000-0000-000000000000',
      email: 'someone@example.com',
      recorderId: 'abc',
    });
    const text = await (await handler(appRequest('GET'))).text();

    assert.deepEqual(Object.keys(JSON.parse(text)).sort(), ['linked', 'linkedAt', 'playerName']);
    assert.doesNotMatch(text, /example\.com|7d1c0000|abc/);
  });

  it('refuses an unverified session with 401 and touches nothing', async () => {
    for (const session of [null, 'forged']) {
      const { handler, calls } = setup({ status: 'linked', playerName: 'Aurora' });
      const response = await handler(appRequest('GET', { session }));

      assert.equal(response.status, 401, String(session));
      assert.equal(calls.length, 0, String(session));
    }
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { handler } = setup({ status: 'rate_limited', retryAfter: 45 });
    const response = await handler(appRequest('GET'));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '45');
  });

  it('answers an unrecognised database answer with a plain 500, not as an unlinked session', async () => {
    const unrecognised = [
      null,
      'linked',
      { status: 'surprise' },
      { status: 'linked' },
      { status: 'linked', playerName: 'Aurora' },
      { status: 'linked', playerName: 42, linkedAt: '2026-11-01T10:00:00+00:00' },
      { status: 'linked', playerName: 'Aurora', linkedAt: { at: 'now' } },
      { status: 'rate_limited' },
    ];

    for (const data of unrecognised) {
      const response = await setup(data).handler(appRequest('GET'));

      assert.equal(response.status, 500, JSON.stringify(data));
      assert.deepEqual(await response.json(), { error: 'Unable to read the link status' });
    }
  });

  it('answers a database failure with a plain 500 that leaks nothing', async () => {
    const { runtime } = testRuntime(() => ({ data: null, error: { code: 'XX000', message: 'secret internals' } }));
    const response = await overwolfEndpoint(linkStatus, runtime)(appRequest('GET'));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to read the link status' });
  });

  it('answers GET and POST only', async () => {
    const { handler, calls } = setup({ status: 'not_linked' });

    assert.equal((await handler(appRequest('DELETE'))).status, 405);
    assert.equal((await handler(appRequest('OPTIONS', { session: null }))).status, 200);
    assert.equal(calls.length, 0);
  });
});
