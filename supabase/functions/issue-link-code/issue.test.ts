import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { issueLinkCode } from './issue.ts';

const body = { playerUid: '1234567', playerName: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' };

describe('issue-link-code', () => {
  it('stores a code for the verified recorder and returns it formatted', async () => {
    const { runtime, calls } = testRuntime(() => ({
      data: { status: 'issued', expiresAt: '2026-11-01T12:10:00Z' },
      error: null,
    }));
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body }));
    const answer = await response.json();

    assert.equal(response.status, 200);
    assert.match(answer.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal(answer.expiresAt, '2026-11-01T12:10:00Z');
    assert.equal(calls[0].name, 'issue_link_code');
    assert.equal(calls[0].args.p_recorder_id, await testRecorder());
    assert.equal(calls[0].args.p_code, answer.code.replace('-', ''));
    assert.equal(calls[0].args.p_player_uid, '1234567');
  });

  it('refuses an unverified session with 401 and touches nothing', async () => {
    const { runtime, calls } = testRuntime();
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { session: null, body }));

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  it('asks the player to play a match first when the app has no uid or name', async () => {
    const { runtime, calls } = testRuntime();
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body: { playerName: 'Aurora' } }));

    assert.equal(response.status, 422);
    assert.equal((await response.json()).reason, 'no-player');
    assert.equal(calls.length, 0);
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { runtime } = testRuntime(() => ({ data: { status: 'rate_limited', retryAfter: 90 }, error: null }));
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body }));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '90');
  });

  it('answers an unrecognised database answer with a plain 500 and no code', async () => {
    const unrecognised = [
      null,
      'issued',
      { status: 'surprise' },
      { status: 'issued' },
      { status: 'rate_limited' },
      { status: 'rate_limited', retryAfter: '90' },
    ];

    for (const data of unrecognised) {
      const { runtime } = testRuntime(() => ({ data, error: null }));
      const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body }));

      assert.equal(response.status, 500, JSON.stringify(data));
      assert.deepEqual(await response.json(), { error: 'Unable to issue a link code' });
    }
  });

  it('draws another code when two recorders collide', async () => {
    let attempts = 0;
    const { runtime, calls } = testRuntime(() =>
      ++attempts === 1
        ? { data: null, error: { code: '23505', message: 'duplicate key' } }
        : { data: { status: 'issued', expiresAt: 'later' }, error: null });
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body }));

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert.notEqual(calls[0].args.p_code, calls[1].args.p_code);
  });

  it('gives up with a plain 500 after repeated collisions', async () => {
    const { runtime, calls } = testRuntime(() => ({ data: null, error: { code: '23505', message: 'duplicate key' } }));
    const response = await overwolfEndpoint(issueLinkCode, runtime)(appRequest('POST', { body }));

    assert.equal(response.status, 500);
    assert.equal(calls.length, 3);
    assert.deepEqual(await response.json(), { error: 'Unable to issue a link code' });
  });
});
