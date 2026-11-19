import type { IncomingMessage, ServerResponse } from 'http';

import { handleSlackRequest, type SlackAnswerEnvironment } from './slack-answer-route.ts';

/** A Slack event is a few kilobytes; anything near this is not one. */
const MAX_BODY_BYTES = 256 * 1024;

const header = (req: IncomingMessage, name: string): string | undefined => {
  const value = req.headers[name];

  return Array.isArray(value) ? value[0] : value;
};

/**
 * The request body byte for byte. The stream is read because the signature covers the exact bytes
 * Slack sent, which a parsed and re-serialised body does not reproduce. When the platform has already
 * kept the bytes on `req.body`, those are used instead. Undefined when the body is too big.
 */
async function readRawBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  const kept = (req as { body?: unknown }).body;
  if (typeof kept === 'string') return new TextEncoder().encode(kept);
  if (kept instanceof Uint8Array) return kept;

  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of req as AsyncIterable<string | Uint8Array>) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;

    size += bytes.length;
    // Keep reading to the end rather than leaving the loop: that would destroy the connection the answer goes out on.
    if (size <= MAX_BODY_BYTES) chunks.push(bytes);
  }
  if (size > MAX_BODY_BYTES) return undefined;

  const body = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return body;
}

/** Runs the Slack Events API endpoint on a Node server: the Vercel function in `api/slack/events.ts` hands over its request and response. */
export async function handleSlackHttp(
  req: IncomingMessage,
  res: ServerResponse,
  env: SlackAnswerEnvironment = process.env,
): Promise<void> {
  const body = await readRawBody(req);
  const answer = body
    ? await handleSlackRequest(
        {
          method: (req.method ?? 'GET').toUpperCase(),
          timestamp: header(req, 'x-slack-request-timestamp'),
          signature: header(req, 'x-slack-signature'),
          body,
          nowMs: Date.now(),
        },
        env,
      )
    : { status: 413, body: { error: 'Request too large' } };

  res.writeHead(answer.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store, max-age=0' });
  res.end(JSON.stringify(answer.body));
}
