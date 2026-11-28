import type { IncomingMessage, ServerResponse } from 'http';

import { handleSlackHttp } from '../../src/server/slack-answer/index.ts';

/** The signature covers the exact bytes Slack sent, so Vercel must not parse the body first. */
export const config = { api: { bodyParser: false } };

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleSlackHttp(req, res);
}
