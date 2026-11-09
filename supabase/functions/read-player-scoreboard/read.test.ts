import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appRequest, testRecorder, testRuntime } from '../_shared/endpoint-test-runtime.ts';
import { overwolfEndpoint } from '../_shared/overwolf-endpoint.ts';
import { readPlayerScoreboard } from './read.ts';

function setup(data: unknown) {
  const { runtime, calls } = testRuntime(() => ({ data, error: null }));
  return { handler: overwolfEndpoint(readPlayerScoreboard, runtime), calls };
}

const LINE = { matchUid: 'm-1', kills: 9, deaths: 2, assists: 14 };

describe('read-player-scoreboard', () => {
  it("reads one player's lines for a verified session", async () => {
    const { handler, calls } = setup({ status: 'ok', lines: [LINE] });
    const response = await handler(appRequest('POST', { body: { playerUid: ' 123 ' } }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { lines: [LINE], limited: false });
    assert.deepEqual(calls, [{
      name: 'read_player_scoreboard_lines',
      args: { p_recorder_id: await testRecorder(), p_player_uid: '123', p_max: 200, p_limit: 240 },
    }]);
  });

  it('says when the answer reached the cap', async () => {
    const lines = Array.from({ length: 200 }, (_, index) => ({ ...LINE, matchUid: `m-${index}` }));
    const { handler } = setup({ status: 'ok', lines });
    const body = await (await handler(appRequest('POST', { body: { playerUid: '123' } }))).json();

    assert.equal(body.limited, true);
  });

  it('refuses a missing or oversized uid without reading', async () => {
    for (const playerUid of [undefined, '', '   ', 123, 'x'.repeat(65)]) {
      const { handler, calls } = setup({ status: 'ok', lines: [] });
      const response = await handler(appRequest('POST', { body: { playerUid } }));

      assert.equal(response.status, 400, String(playerUid));
      assert.equal(calls.length, 0, String(playerUid));
    }
  });

  it('passes on only the match key and the three figures', async () => {
    const { handler } = setup({ status: 'ok', lines: [{ ...LINE, name: 'Aurora', kills: '9', uploader: 'hash' }] });
    const text = await (await handler(appRequest('POST', { body: { playerUid: '123' } }))).text();

    assert.deepEqual(JSON.parse(text).lines, [{ matchUid: 'm-1', kills: null, deaths: 2, assists: 14 }]);
    assert.doesNotMatch(text, /Aurora|hash/);
  });

  it('refuses an unverified session with 401 and touches nothing', async () => {
    for (const session of [null, 'forged']) {
      const { handler, calls } = setup({ status: 'ok', lines: [LINE] });
      const response = await handler(appRequest('POST', { session, body: { playerUid: '123' } }));

      assert.equal(response.status, 401, String(session));
      assert.equal(calls.length, 0, String(session));
    }
  });

  it('tells a rate-limited recorder when to come back', async () => {
    const { handler } = setup({ status: 'rate_limited', retryAfter: 12 });
    const response = await handler(appRequest('POST', { body: { playerUid: '123' } }));

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '12');
  });

  it('answers 500 without detail when the database answer is malformed', async () => {
    const { handler } = setup({ status: 'ok', lines: [{ kills: 1 }] });
    const response = await handler(appRequest('POST', { body: { playerUid: '123' } }));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to read the player scoreboard' });
  });
});
