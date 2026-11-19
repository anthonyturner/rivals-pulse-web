import { plainTextOfSlack, slackAnswerAlreadyPosted, slackAnswerComment } from './answer-comment';
import { answerFromSlack, type GithubPort, type SlackAnswerConfig, type SlackPort } from './slack-answer';
import { handleSlackRequest, type SlackAnswerEnvironment } from './slack-answer-route';
import { verifySlackSignature } from './slack-signature';
import { githubTargetOf } from './slack-thread';

const SECRET = 'test-signing-secret';
const NOW_MS = Date.parse('2026-11-09T12:00:00Z');
const NOW_SECONDS = String(NOW_MS / 1000);
const REPOSITORIES = ['anthonyturner/rivals-pulse-web', 'anthonyturner/rivals_pulse'];
const CONFIG: SlackAnswerConfig = { tonyUserId: 'UTONY', channelId: 'CNEEDS', repositories: REPOSITORIES };

const encode = (text: string) => new TextEncoder().encode(text);

async function sign(body: string, timestamp = NOW_SECONDS, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encode(`v0:${timestamp}:${body}`)));

  return `v0=${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

describe('verifySlackSignature', () => {
  const body = '{"type":"event_callback","url":"https:\\/\\/example.com"}';

  it('accepts a request Slack signed with our secret, byte for byte', async () => {
    const signature = await sign(body);

    expect(await verifySlackSignature({ signingSecret: SECRET, timestamp: NOW_SECONDS, signature, body: encode(body), nowMs: NOW_MS })).toBeTrue();
  });

  it('refuses a body that changed by one byte', async () => {
    const signature = await sign(body);

    expect(await verifySlackSignature({ signingSecret: SECRET, timestamp: NOW_SECONDS, signature, body: encode(body + ' '), nowMs: NOW_MS })).toBeFalse();
  });

  it('refuses a signature made with another secret', async () => {
    const signature = await sign(body, NOW_SECONDS, 'another-secret');

    expect(await verifySlackSignature({ signingSecret: SECRET, timestamp: NOW_SECONDS, signature, body: encode(body), nowMs: NOW_MS })).toBeFalse();
  });

  it('refuses a request older or newer than five minutes, so a captured one cannot be replayed', async () => {
    for (const offsetSeconds of [-301, 301]) {
      const timestamp = String(NOW_MS / 1000 + offsetSeconds);
      const signature = await sign(body, timestamp);

      expect(await verifySlackSignature({ signingSecret: SECRET, timestamp, signature, body: encode(body), nowMs: NOW_MS })).toBeFalse();
    }
  });

  it('refuses missing or malformed headers and an empty secret without throwing', async () => {
    const signature = await sign(body);
    const base = { signingSecret: SECRET, timestamp: NOW_SECONDS, signature, body: encode(body), nowMs: NOW_MS };

    expect(await verifySlackSignature({ ...base, signature: undefined })).toBeFalse();
    expect(await verifySlackSignature({ ...base, signature: 'v0=abc' })).toBeFalse();
    expect(await verifySlackSignature({ ...base, signature: signature.replace('v0=', 'v1=') })).toBeFalse();
    expect(await verifySlackSignature({ ...base, timestamp: undefined })).toBeFalse();
    expect(await verifySlackSignature({ ...base, timestamp: 'soon' })).toBeFalse();
    expect(await verifySlackSignature({ ...base, signingSecret: '' })).toBeFalse();
  });
});

describe('githubTargetOf', () => {
  const web = 'https://github.com/anthonyturner/rivals-pulse-web';

  it('reads the issue from the attachment title link of the GitHub app', () => {
    const message = { text: 'New comment', attachments: [{ title_link: `${web}/issues/721#issuecomment-5`, text: `see ${web}/pull/714` }] };

    expect(githubTargetOf(message, REPOSITORIES)).toEqual({ repository: 'anthonyturner/rivals-pulse-web', number: 721 });
  });

  it('reads it from the first block when the app uses blocks, and a pull request link too', () => {
    const message = { blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `<${web}/pull/728|#728 Title>` } }, { text: `${web}/issues/1` }] };

    expect(githubTargetOf(message, REPOSITORIES)).toEqual({ repository: 'anthonyturner/rivals-pulse-web', number: 728 });
  });

  it('prefers the headline link over a link mentioned in the comment text', () => {
    const message = { text: `${web}/issues/9`, attachments: [{ title_link: `${web}/issues/721`, text: `${web}/issues/9` }] };

    expect(githubTargetOf(message, REPOSITORIES)?.number).toBe(721);
  });

  it('falls back to any link in the message, for the overlay repository too', () => {
    const message = { text: '<https://github.com/anthonyturner/rivals_pulse/issues/1570|#1570>' };

    expect(githubTargetOf(message, REPOSITORIES)).toEqual({ repository: 'anthonyturner/rivals_pulse', number: 1570 });
  });

  it('ignores another repository and a message with no link', () => {
    expect(githubTargetOf({ text: 'https://github.com/someone/else/issues/3' }, REPOSITORIES)).toBeUndefined();
    expect(githubTargetOf({ text: 'no link here' }, REPOSITORIES)).toBeUndefined();
    expect(githubTargetOf(undefined, REPOSITORIES)).toBeUndefined();
  });
});

describe('the comment posted for Tony', () => {
  it('starts with what he said and carries a footer keyed by the Slack time', () => {
    const comment = slackAnswerComment('merge 714', '1731158400.000200');

    expect(comment.startsWith('merge 714\n')).toBeTrue();
    expect(comment).toContain('<!-- tony-answer:slack ts=1731158400.000200 -->');
    expect(comment).not.toContain('<!-- agent -->');
  });

  it('turns Slack markup into plain text and stops a mention from notifying anyone', () => {
    const plain = plainTextOfSlack('ok &amp; go <https://example.com/x|link> <@U123> @octocat &lt;b&gt;');

    expect(plain).toContain('ok & go https://example.com/x (Slack mention) @​octocat <b>');
  });

  it('cuts a very long reply', () => {
    expect(plainTextOfSlack('a'.repeat(5000)).length).toBeLessThan(4100);
  });

  it('is recognised as already posted only for the same Slack time', () => {
    const comment = slackAnswerComment('yes', '1.1');

    expect(slackAnswerAlreadyPosted(['other', comment], '1.1')).toBeTrue();
    expect(slackAnswerAlreadyPosted([comment], '1.2')).toBeFalse();
  });
});

interface Fakes {
  slack: SlackPort;
  github: GithubPort;
  reactions: string[];
  comments: string[];
  existing: string[];
}

function fakes(options: { parent?: unknown; issue?: { open: boolean; labels: string[] } | undefined } = {}): Fakes {
  const state: Fakes = { reactions: [], comments: [], existing: [] } as unknown as Fakes;
  const parent = 'parent' in options ? options.parent : { attachments: [{ title_link: 'https://github.com/anthonyturner/rivals-pulse-web/issues/721' }] };
  const issue = 'issue' in options ? options.issue : { open: true, labels: ['needs-tony', 'ready'] };

  state.slack = {
    threadParent: async () => parent,
    react: async (_channel, _ts, name) => {
      state.reactions.push(name);
    },
  };
  state.github = {
    issue: async () => issue,
    commentBodiesSince: async () => state.existing,
    addComment: async (_target, body) => {
      state.comments.push(body);
    },
  };

  return state;
}

const reply = (overrides: Record<string, unknown> = {}) => ({
  type: 'event_callback',
  event: { type: 'message', channel: 'CNEEDS', user: 'UTONY', text: 'merge 714', ts: '200.2', thread_ts: '100.1', ...overrides },
});

describe('answerFromSlack', () => {
  it("posts Tony's reply as a comment on the issue the thread is about, and confirms in Slack", async () => {
    const f = fakes();

    const outcome = await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS);

    expect(outcome).toEqual({ status: 'posted', target: { repository: 'anthonyturner/rivals-pulse-web', number: 721 } });
    expect(f.comments.length).toBe(1);
    expect(f.comments[0].startsWith('merge 714\n')).toBeTrue();
    expect(f.reactions).toEqual(['white_check_mark']);
  });

  it('ignores everyone but Tony, however the message looks', async () => {
    for (const user of ['USOMEONE', undefined]) {
      const f = fakes();

      expect((await answerFromSlack(reply({ user }), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('ignored');
      expect(f.comments).toEqual([]);
    }

    const bot = fakes();
    expect((await answerFromSlack(reply({ bot_id: 'B1' }), CONFIG, bot.slack, bot.github, NOW_MS)).status).toBe('ignored');
    expect(bot.comments).toEqual([]);
  });

  it('ignores another channel, a message that is not in a thread, a thread parent, an edit and an empty reply', async () => {
    const cases = [{ channel: 'COTHER' }, { thread_ts: undefined }, { thread_ts: '200.2' }, { subtype: 'message_changed' }, { subtype: 'file_share' }, { text: '  ' }, { text: undefined }, { type: 'reaction_added' }];

    for (const overrides of cases) {
      const f = fakes();

      expect((await answerFromSlack(reply(overrides), CONFIG, f.slack, f.github, NOW_MS)).status).withContext(JSON.stringify(overrides)).toBe('ignored');
      expect(f.comments).toEqual([]);
    }
  });

  it('accepts a reply that was also sent to the channel', async () => {
    const f = fakes();

    expect((await answerFromSlack(reply({ subtype: 'thread_broadcast' }), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('posted');
  });

  it('warns Tony, and posts nothing, when the thread links no issue', async () => {
    const f = fakes({ parent: { text: 'no link' } });

    expect((await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('unanswerable');
    expect(f.comments).toEqual([]);
    expect(f.reactions).toEqual(['warning']);
  });

  it('warns Tony when the thread has gone', async () => {
    const f = fakes({ parent: undefined });

    expect((await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('unanswerable');
  });

  it('warns Tony, and posts nothing, when the issue is closed, missing or no longer needs him', async () => {
    for (const issue of [{ open: false, labels: ['needs-tony'] }, undefined, { open: true, labels: ['tony-answered'] }]) {
      const f = fakes({ issue });

      expect((await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('unanswerable');
      expect(f.comments).toEqual([]);
      expect(f.reactions).toEqual(['warning']);
    }
  });

  it('posts once when Slack delivers the same reply again', async () => {
    const f = fakes();

    await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS);
    f.existing = [...f.comments];

    expect((await answerFromSlack(reply(), CONFIG, f.slack, f.github, NOW_MS)).status).toBe('duplicate');
    expect(f.comments.length).toBe(1);
  });

  it('does not treat a malformed payload as an answer', async () => {
    const f = fakes();

    for (const payload of [undefined, null, {}, { event: 'x' }]) {
      expect((await answerFromSlack(payload, CONFIG, f.slack, f.github, NOW_MS)).status).toBe('ignored');
    }
  });
});

describe('handleSlackRequest', () => {
  const ENV: SlackAnswerEnvironment = {
    SLACK_SIGNING_SECRET: SECRET,
    SLACK_BOT_TOKEN: 'xoxb-test',
    SLACK_TONY_USER_ID: 'UTONY',
    SLACK_NEEDS_TONY_CHANNEL_ID: 'CNEEDS',
    TONY_ANSWER_GITHUB_TOKEN: 'token-test',
  };

  async function post(payload: unknown, env: SlackAnswerEnvironment = ENV, f: Fakes = fakes(), signature?: string) {
    const raw = JSON.stringify(payload);
    const response = await handleSlackRequest(
      { method: 'POST', timestamp: NOW_SECONDS, signature: signature ?? (await sign(raw)), body: encode(raw), nowMs: NOW_MS },
      env,
      () => f,
    );

    return { response, f };
  }

  it('echoes the challenge of a signed URL verification', async () => {
    const { response } = await post({ type: 'url_verification', challenge: 'abc' }, { SLACK_SIGNING_SECRET: SECRET });

    expect(response).toEqual({ status: 200, body: { challenge: 'abc' } });
  });

  it('refuses an unsigned or wrongly signed request before reading it', async () => {
    const { response, f } = await post(reply(), ENV, fakes(), 'v0=' + '0'.repeat(64));

    expect(response.status).toBe(401);
    expect(f.comments).toEqual([]);

    const unsigned = await handleSlackRequest({ method: 'POST', body: encode('{}'), nowMs: NOW_MS }, ENV, () => f);
    expect(unsigned.status).toBe(401);
  });

  it('refuses a challenge that is not signed', async () => {
    const response = await handleSlackRequest({ method: 'POST', body: encode('{"type":"url_verification","challenge":"x"}'), nowMs: NOW_MS }, ENV);

    expect(response.status).toBe(401);
  });

  it('answers 405 to anything but a POST and 503 while the signing secret is missing', async () => {
    expect((await handleSlackRequest({ method: 'GET', body: new Uint8Array(), nowMs: NOW_MS }, ENV)).status).toBe(405);
    expect((await post({}, {})).response.status).toBe(503);
  });

  it('answers 503 for an event while the rest of the setup is missing', async () => {
    const { response, f } = await post(reply(), { SLACK_SIGNING_SECRET: SECRET });

    expect(response.status).toBe(503);
    expect(f.comments).toEqual([]);
  });

  it('answers 400 for a signed body that is not JSON', async () => {
    const raw = 'not json';
    const response = await handleSlackRequest({ method: 'POST', timestamp: NOW_SECONDS, signature: await sign(raw), body: encode(raw), nowMs: NOW_MS }, ENV);

    expect(response.status).toBe(400);
  });

  it("posts a signed reply from Tony and says only what happened, never his text", async () => {
    const { response, f } = await post(reply());

    expect(response).toEqual({ status: 200, body: { outcome: 'posted' } });
    expect(f.comments.length).toBe(1);
  });

  it('answers 200 and posts nothing for a signed reply from someone else', async () => {
    const { response, f } = await post(reply({ user: 'USOMEONE' }));

    expect(response.status).toBe(200);
    expect(f.comments).toEqual([]);
  });

  it('answers 502 when GitHub fails, so that Slack delivers the reply again', async () => {
    const f = fakes();

    f.github.addComment = async () => {
      throw new Error('GitHub comment failed: 500');
    };
    spyOn(console, 'error');

    expect((await post(reply(), ENV, f)).response.status).toBe(502);
  });
});
