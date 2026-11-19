import { answerFromSlack, type GithubPort, type SlackAnswerConfig, type SlackPort } from './slack-answer.ts';
import { createGithubPort, createSlackPort } from './slack-clients.ts';
import { verifySlackSignature } from './slack-signature.ts';

/** Every repository whose needs-tony items the Slack channel carries. */
export const ANSWERABLE_REPOSITORIES = ['anthonyturner/rivals-pulse-web', 'anthonyturner/rivals_pulse'] as const;

export interface SlackRequest {
  method: string;
  /** The `X-Slack-Request-Timestamp` header. */
  timestamp?: string;
  /** The `X-Slack-Signature` header. */
  signature?: string;
  /** The body as it arrived, byte for byte: the signature covers it. */
  body: Uint8Array;
  nowMs: number;
}

export interface SlackResponse {
  status: number;
  body: unknown;
}

/** The names of the settings the route reads; their values live only in the environment. */
export interface SlackAnswerEnvironment {
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_TONY_USER_ID?: string;
  SLACK_NEEDS_TONY_CHANNEL_ID?: string;
  TONY_ANSWER_GITHUB_TOKEN?: string;
}

export interface SlackAnswerPorts {
  slack: SlackPort;
  github: GithubPort;
}

const json = (status: number, body: unknown): SlackResponse => ({ status, body });

/**
 * The Slack Events API endpoint, free of any server framework (`slack-answer-http.ts` is the Node
 * adapter). A request is trusted only after its Slack signature checks out; after that it is a
 * challenge to echo or an event for `answerFromSlack`. Nothing here echoes a secret or the event text.
 */
export async function handleSlackRequest(
  request: SlackRequest,
  env: SlackAnswerEnvironment,
  makePorts: (env: SlackAnswerEnvironment) => SlackAnswerPorts = defaultPorts,
): Promise<SlackResponse> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!env.SLACK_SIGNING_SECRET) return json(503, { error: 'Slack answers are not set up' });

  const verified = await verifySlackSignature({
    signingSecret: env.SLACK_SIGNING_SECRET,
    timestamp: request.timestamp,
    signature: request.signature,
    body: request.body,
    nowMs: request.nowMs,
  });
  if (!verified) return json(401, { error: 'Bad Slack signature' });

  let payload: { type?: unknown; challenge?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(request.body));
  } catch {
    return json(400, { error: 'Not JSON' });
  }

  if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
    return json(200, { challenge: payload.challenge });
  }
  if (payload.type !== 'event_callback') return json(200, { outcome: 'ignored', reason: 'not an event' });

  const config = configOf(env);
  if (!config || !env.SLACK_BOT_TOKEN || !env.TONY_ANSWER_GITHUB_TOKEN) return json(503, { error: 'Slack answers are not set up' });

  try {
    const { slack, github } = makePorts(env);
    const outcome = await answerFromSlack(payload, config, slack, github, request.nowMs);

    return json(200, { outcome: outcome.status, ...('reason' in outcome ? { reason: outcome.reason } : {}) });
  } catch (error) {
    console.error('Slack answer failed', error instanceof Error ? error.message : 'unknown error');

    // A 5xx makes Slack deliver the event again; the footer on the posted comment keeps a retry from posting twice.
    return json(502, { error: 'Could not post the answer' });
  }
}

function configOf(env: SlackAnswerEnvironment): SlackAnswerConfig | undefined {
  if (!env.SLACK_TONY_USER_ID || !env.SLACK_NEEDS_TONY_CHANNEL_ID) return undefined;

  return { tonyUserId: env.SLACK_TONY_USER_ID, channelId: env.SLACK_NEEDS_TONY_CHANNEL_ID, repositories: ANSWERABLE_REPOSITORIES };
}

function defaultPorts(env: SlackAnswerEnvironment): SlackAnswerPorts {
  return { slack: createSlackPort(env.SLACK_BOT_TOKEN ?? ''), github: createGithubPort(env.TONY_ANSWER_GITHUB_TOKEN ?? '') };
}
