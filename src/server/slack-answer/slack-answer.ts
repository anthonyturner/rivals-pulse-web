import { slackAnswerAlreadyPosted, slackAnswerComment } from './answer-comment.ts';
import { githubTargetOf, type GithubTarget } from './slack-thread.ts';

const NEEDS_TONY = 'needs-tony';
/** How far back to look for the comment a retried delivery already posted. */
const RETRY_WINDOW_MS = 60 * 60 * 1000;

export interface SlackAnswerConfig {
  /** Tony's Slack member id (`U...`): the only author whose replies count. */
  tonyUserId: string;
  /** The channel id (`C...` or `G...`) the GitHub app posts needs-tony items to. */
  channelId: string;
  /** `owner/repo` of every repository an answer may be posted to. */
  repositories: readonly string[];
}

export interface SlackPort {
  /** The first message of a thread, or undefined when Slack has no such thread. */
  threadParent(channel: string, threadTs: string): Promise<unknown>;
  /** Best effort: a failed reaction never changes the outcome. */
  react(channel: string, ts: string, name: string): Promise<void>;
}

export interface GithubPort {
  issue(target: GithubTarget): Promise<{ open: boolean; labels: string[] } | undefined>;
  /** Bodies of the comments created at or after `sinceIso`. */
  commentBodiesSince(target: GithubTarget, sinceIso: string): Promise<string[]>;
  addComment(target: GithubTarget, body: string): Promise<void>;
}

export type SlackAnswerOutcome =
  | { status: 'posted'; target: GithubTarget }
  | { status: 'duplicate'; target: GithubTarget }
  | { status: 'ignored'; reason: string }
  /** Tony replied, but there is nothing to answer; he is told with a reaction. */
  | { status: 'unanswerable'; reason: string };

interface SlackMessageEvent {
  type?: unknown;
  subtype?: unknown;
  bot_id?: unknown;
  user?: unknown;
  channel?: unknown;
  text?: unknown;
  ts?: unknown;
  thread_ts?: unknown;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/**
 * Turns Tony's reply in the Slack thread under a needs-tony message into a comment on that issue. The
 * comment then goes through the same workflow as a comment he types on GitHub, so it removes `needs-tony`
 * and adds `tony-answered`; nothing here merges or pushes, and the text is only ever posted, never run.
 *
 * Only a plain reply from Tony in the one channel counts. `payload` is a verified Slack event body.
 */
export async function answerFromSlack(
  payload: unknown,
  config: SlackAnswerConfig,
  slack: SlackPort,
  github: GithubPort,
  nowMs: number,
): Promise<SlackAnswerOutcome> {
  const event = ((payload as { event?: unknown } | null)?.event ?? {}) as SlackMessageEvent;

  if (event.type !== 'message') return { status: 'ignored', reason: 'not a message' };
  if (event.channel !== config.channelId) return { status: 'ignored', reason: 'another channel' };
  if (event.user !== config.tonyUserId || event.bot_id) return { status: 'ignored', reason: 'not Tony' };
  if (event.subtype !== undefined && event.subtype !== 'thread_broadcast') {
    return { status: 'ignored', reason: 'an edit, a file or another kind of message' };
  }
  if (!isText(event.ts) || !isText(event.thread_ts) || event.thread_ts === event.ts) {
    return { status: 'ignored', reason: 'not a reply in a thread' };
  }
  if (!isText(event.text) || event.text.trim() === '') return { status: 'ignored', reason: 'no text' };

  const { channel, ts, thread_ts: threadTs, text } = event as { channel: string; ts: string; thread_ts: string; text: string };
  const unanswerable = async (reason: string): Promise<SlackAnswerOutcome> => {
    await slack.react(channel, ts, 'warning');

    return { status: 'unanswerable', reason };
  };

  const target = githubTargetOf(await slack.threadParent(channel, threadTs), config.repositories);
  if (!target) return unanswerable('the first message of the thread links no issue or pull request here');

  const issue = await github.issue(target);
  if (!issue?.open) return unanswerable('the issue is closed or missing');
  if (!issue.labels.includes(NEEDS_TONY)) return unanswerable(`the issue is not labelled ${NEEDS_TONY}`);

  const since = new Date(nowMs - RETRY_WINDOW_MS).toISOString();
  if (slackAnswerAlreadyPosted(await github.commentBodiesSince(target, since), ts)) {
    return { status: 'duplicate', target };
  }

  await github.addComment(target, slackAnswerComment(text, ts));
  await slack.react(channel, ts, 'white_check_mark');

  return { status: 'posted', target };
}
