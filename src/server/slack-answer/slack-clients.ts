import type { GithubPort, SlackPort } from './slack-answer.ts';
import type { GithubTarget } from './slack-thread.ts';

type Fetcher = typeof fetch;

interface SlackReply {
  ok?: boolean;
  error?: string;
  messages?: unknown[];
}

/** Slack Web API calls with the app's bot token. Only the two the answer route needs. */
export function createSlackPort(botToken: string, fetcher: Fetcher = fetch): SlackPort {
  const call = async (method: string, init: RequestInit, query = ''): Promise<SlackReply> => {
    const response = await fetcher(`https://slack.com/api/${method}${query}`, {
      ...init,
      headers: { authorization: `Bearer ${botToken}`, ...(init.headers as Record<string, string> | undefined) },
    });

    return (await response.json()) as SlackReply;
  };

  return {
    async threadParent(channel, threadTs) {
      const query = `?${new URLSearchParams({ channel, ts: threadTs, limit: '1', inclusive: 'true' })}`;
      const reply = await call('conversations.replies', { method: 'GET' }, query);

      if (reply.ok) return reply.messages?.[0];
      if (reply.error === 'thread_not_found' || reply.error === 'message_not_found') return undefined;

      throw new Error(`Slack conversations.replies failed: ${reply.error ?? 'no answer'}`);
    },

    async react(channel, ts, name) {
      try {
        await call('reactions.add', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ channel, timestamp: ts, name }),
        });
      } catch {
        // A reaction only tells Tony it landed; the answer already stands without it.
      }
    },
  };
}

interface GithubIssue {
  state?: string;
  labels?: ({ name?: string } | string)[];
}

/** GitHub REST calls with a token that belongs to Tony's own account, so the comment is his. */
export function createGithubPort(token: string, fetcher: Fetcher = fetch): GithubPort {
  const request = async (path: string, init: RequestInit = {}): Promise<Response> =>
    fetcher(`https://api.github.com${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'rivals-pulse-slack-answer',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  const issuePath = ({ repository, number }: GithubTarget) => `/repos/${repository}/issues/${number}`;

  return {
    async issue(target) {
      const response = await request(issuePath(target));

      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`GitHub issue read failed: ${response.status}`);

      const issue = (await response.json()) as GithubIssue;

      return {
        open: issue.state === 'open',
        labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : (label.name ?? ''))),
      };
    },

    async commentBodiesSince(target, sinceIso) {
      const query = new URLSearchParams({ since: sinceIso, per_page: '100' });
      const response = await request(`${issuePath(target)}/comments?${query}`);

      if (!response.ok) throw new Error(`GitHub comments read failed: ${response.status}`);

      return ((await response.json()) as { body?: string }[]).map((comment) => comment.body ?? '');
    },

    async addComment(target, body) {
      const response = await request(`${issuePath(target)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) throw new Error(`GitHub comment failed: ${response.status}`);
    },
  };
}
