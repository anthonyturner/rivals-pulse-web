import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it } from 'node:test';
import { Readable } from 'node:stream';

import { handleSlackHttp } from '../src/server/slack-answer/slack-answer-http.ts';

const SECRET = 'test-signing-secret';
const root = new URL('../', import.meta.url);

/** The signature a real Slack sends: HMAC-SHA256 over `v0:<timestamp>:<raw body>`, computed here with Node's own crypto. */
const signed = (body: string, timestamp: string) => `v0=${createHmac('sha256', SECRET).update(`v0:${timestamp}:${body}`).digest('hex')}`;

function request(body: string, headers: Record<string, string>, extra: Record<string, unknown> = {}): IncomingMessage {
  return Object.assign(Readable.from([Buffer.from(body)]), { method: 'POST', headers, ...extra }) as unknown as IncomingMessage;
}

async function send(req: IncomingMessage) {
  const sent: { status?: number; headers?: Record<string, string>; body?: string } = {};
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      sent.status = status;
      sent.headers = headers;
    },
    end(body: string) {
      sent.body = body;
    },
  } as unknown as ServerResponse;

  await handleSlackHttp(req, res, { SLACK_SIGNING_SECRET: SECRET });

  return sent;
}

describe('the Slack events adapter', () => {
  // Slack escapes slashes in its JSON, which JSON.parse then JSON.stringify would not reproduce.
  const body = '{"type":"url_verification","challenge":"c\\/h","note":"caf\\u00e9"}';

  it('verifies the signature over the bytes that arrived and echoes the challenge', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sent = await send(request(body, { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signed(body, timestamp) }));

    assert.equal(sent.status, 200);
    assert.deepEqual(JSON.parse(sent.body ?? ''), { challenge: 'c/h' });
    assert.equal(sent.headers?.['cache-control'], 'private, no-store, max-age=0');
  });

  it('reads the bytes from req.body when the platform kept them', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signed(body, timestamp) };
    const sent = await send(request('', headers, { body: Buffer.from(body) }));

    assert.equal(sent.status, 200);
  });

  it('refuses a request whose signature does not match', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sent = await send(request(body, { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signed(`${body} `, timestamp) }));

    assert.equal(sent.status, 401);
  });

  it('refuses a body that is too large with 413', async () => {
    const sent = await send(request('x'.repeat(300 * 1024), {}));

    assert.equal(sent.status, 413);
  });
});

describe('the Vercel file for the Slack events route', () => {
  it('turns off body parsing and hands the request to the adapter', () => {
    const code = readFileSync(new URL('api/slack/events.ts', root), 'utf8');

    assert.match(code, /bodyParser: false/);
    assert.match(code, /handleSlackHttp\(req, res\)/);
  });
});
