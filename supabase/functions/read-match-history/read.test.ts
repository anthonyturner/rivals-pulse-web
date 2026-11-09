import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { readMatchHistory } from './read.ts';

function setup(data: unknown) {
  const { runtime, calls } = testRuntime(() => ({ data, error: null }));
  return { handler: overwolfEndpoint(readMatchHistory, runtime), calls };
}

const MATCH = {
  matchUid: 'm-1',
  playedAt: '2026-11-08T10:00:00+00:00',
  recordedAt: '2026-11-08T10:20:00+00:00',
  rawPayload: { map_name: 'Tokyo 2099', match_players: [] },
  performance: { player_uid: '123', kills: 9 },
};

describe('read-match-history', () => {
  it("reads the verified recorder's own matches, newest first, keyed on the recorder alone", async () => {
    const { handler, calls } = setup({ status: 'ok', matches: [MATCH] });
    const response = await handler(appRequest('POST', { body: { after: '2026-11-01T00:00:00Z' } }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { matches: [MATCH] });
    assert.deepEqual(calls, [{
      name: 'read_own_tracked_matches',
      args: { p_recorder_id: await testRecorder(), p_after: '2026-11-01T00:00:00Z', p_max: 200, p_limit: 120 },
    }]);
  });

  it('reads every match when no time is given, and ignores a name the caller claims', async () => {
    for (const body of [undefined, {}, { after: null }, { normalizedName: 'someone else' }]) {
      const { handler, calls } = setup({ status: 'ok', matches: [] });
      const response = await handler(appRequest('POST', { body }));

      assert.equal(response.status, 200, JSON.stringify(body));
      assert.deepEqual(calls[0].args, { p_recorder_id: await testRecorder(), p_after: null, p_max: 200, p_limit: 120 });
    }
  });

  it('refuses a time that is not one, without reading', async () => {
    for (const after of ['yesterday', 42]) {
      const { handler, calls } = setup({ status: 'ok', matches: [] });
      const response = await handler(appRequest('POST', { body: { after } }));

      assert.equal(response.status, 400, String(after));
      assert.equal(calls.length, 0, String(after));
    }
  });

  it('passes on only the five fields the app reads', async () => {
    const { handler } = setup({ status: 'ok', matches: [{ ...MATCH, recordedBy: 'hash', playerId: 7, normalizedName: 'aurora' }] });
    const text = await (await handler(appRequest('POST'))).text();

    assert.deepEqual(Object.keys(JSON.parse(text).matches[0]).sort(), ['matchUid', 'performance', 'playedAt', 'rawPayload', 'recordedAt']);
    assert.doesNotMatch(text, /hash|aurora|playerId/);
  });

  it('refuses an unverified session with 401 and touches nothing', async () => {
    for (const session of [null, 'forged']) {
      const { handler, calls } = setup({ status: 'ok', matches: [MATCH] });
      const response = await handler(appRequest('POST', { session }));

      assert.equal(response.status, 401, String(session));
      assert.equal(calls.length, 0, String(session));
    }
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { handler } = setup({ status: 'rate_limited', retryAfter: 30 });
    const response = await handler(appRequest('POST'));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '30');
  });

  it('answers 500 without detail when the database answer is malformed', async () => {
    for (const data of [{ status: 'ok' }, { status: 'ok', matches: [{ matchUid: 3 }] }, { status: 'surprise' }]) {
      const { handler } = setup(data);
      const response = await handler(appRequest('POST'));

      assert.equal(response.status, 500, JSON.stringify(data));
      assert.deepEqual(await response.json(), { error: 'Unable to read the match history' });
    }
  });

  it('answers only POST', async () => {
    const { handler } = setup({ status: 'ok', matches: [] });
    assert.equal((await handler(appRequest('GET'))).status, 405);
  });
});
