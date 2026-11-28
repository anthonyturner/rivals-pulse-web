import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DIGEST_TITLE,
  collectInbox,
  createClient,
  createCostMeter,
  digestComment,
  formatWaited,
  latestLabeledAt,
  run,
} from './needs-tony-digest.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-09T14:00:00Z');
const WEB = 'anthonyturner/rivals-pulse-web';
const OVERLAY = 'anthonyturner/rivals_pulse';

test('formatWaited speaks in hours under a day and days beyond', () => {
  assert.equal(formatWaited(5 * 60_000), 'under an hour');
  assert.equal(formatWaited(-HOUR), 'under an hour');
  assert.equal(formatWaited(HOUR), '1 hour');
  assert.equal(formatWaited(23 * HOUR + 59 * 60_000), '23 hours');
  assert.equal(formatWaited(DAY), '1 day');
  assert.equal(formatWaited(2 * DAY + 3 * HOUR), '2 days 3 hours');
  assert.equal(formatWaited(3 * DAY + HOUR), '3 days 1 hour');
  assert.equal(formatWaited(9 * DAY + 5 * HOUR), '9 days');
});

test('latestLabeledAt takes the newest needs-tony labeled event and ignores the rest', () => {
  const events = [
    { event: 'labeled', label: { name: 'needs-tony' }, created_at: '2026-11-01T10:00:00Z' },
    { event: 'unlabeled', label: { name: 'needs-tony' }, created_at: '2026-11-02T10:00:00Z' },
    { event: 'labeled', label: { name: 'needs-tony' }, created_at: '2026-11-05T10:00:00Z' },
    { event: 'labeled', label: { name: 'ready' }, created_at: '2026-11-08T10:00:00Z' },
    { event: 'commented', created_at: '2026-11-09T10:00:00Z' },
  ];
  assert.equal(latestLabeledAt(events), '2026-11-05T10:00:00Z');
  assert.equal(latestLabeledAt([]), null);
});

test('an empty inbox yields no comment', () => {
  assert.equal(digestComment([], NOW), null);
});

test('the comment mentions Tony and lists every item, longest wait first', () => {
  const comment = digestComment(
    [
      { repository: OVERLAY, number: 9, title: 'Newer', url: 'https://github.com/x/9', waitingSince: '2026-11-09T11:00:00Z' },
      { repository: WEB, number: 4, title: 'Older', url: 'https://github.com/x/4', waitingSince: '2026-11-06T11:00:00Z' },
    ],
    NOW,
  );
  assert.equal(
    comment,
    [
      '@anthonyturner, 2 items waiting on you:',
      '',
      `- ${WEB}#4 [Older](https://github.com/x/4), waiting 3 days 3 hours`,
      `- ${OVERLAY}#9 [Newer](https://github.com/x/9), waiting 3 hours`,
    ].join('\n'),
  );
});

test('a single item reads as one item', () => {
  const comment = digestComment(
    [{ repository: 'r/r', number: 1, title: 'Only', url: 'u', waitingSince: '2026-11-09T14:00:00Z' }],
    NOW,
  );
  assert.match(comment, /^@anthonyturner, 1 item waiting on you:/);
});

test('titles cannot ping other people or break the list', () => {
  const comment = digestComment(
    [{ repository: 'r/r', number: 1, title: 'Ask @octocat [now]\nplease `x`', url: 'u', waitingSince: '2026-11-09T14:00:00Z' }],
    NOW,
  );
  assert.ok(comment.includes('[Ask &#64;octocat \\[now\\] please \\`x\\`](u)'));
  assert.equal(comment.split('\n').length, 3);
});

/** A fake of the GitHub REST API: each route answers with a status and body, and every call is recorded. */
function fakeGitHub(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = url.replace('https://api.github.com', '');
    calls.push({ method: init.method, path, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers.Authorization });
    const route = routes[`${init.method} ${path}`];
    if (route === undefined) throw new Error(`unexpected ${init.method} ${path}`);
    const { status = 200, body, link } = route;
    return {
      ok: status < 400,
      status,
      headers: new Headers({ 'x-ratelimit-remaining': '4990', ...(link ? { link } : {}) }),
      json: async () => body,
    };
  };
  return { calls, client: (token) => createClient({ token, meter: createCostMeter(token), fetchImpl }) };
}

const issueRoute = (repository) => `GET /repos/${repository}/issues?labels=needs-tony&state=open&per_page=100`;
const eventsRoute = (repository, number) => `GET /repos/${repository}/issues/${number}/events?per_page=100`;
const labeled = (at) => [{ event: 'labeled', label: { name: 'needs-tony' }, created_at: at }];

test('collectInbox reads both repositories, follows pages and times each wait from its newest label event', async () => {
  const github = fakeGitHub({
    [issueRoute(WEB)]: {
      body: [{ number: 1, title: 'One', html_url: 'u1', created_at: '2026-10-01T00:00:00Z' }],
      link: `<https://api.github.com/repos/${WEB}/issues?page=2>; rel="next"`,
    },
    [`GET /repos/${WEB}/issues?page=2`]: {
      body: [{ number: 2, title: 'Two', html_url: 'u2', created_at: '2026-10-01T00:00:00Z' }],
    },
    [eventsRoute(WEB, 1)]: { body: labeled('2026-11-08T00:00:00Z') },
    [eventsRoute(WEB, 2)]: { body: [] },
    [issueRoute(OVERLAY)]: { body: [{ number: 7, title: 'Seven', html_url: 'u7', created_at: '2026-10-02T00:00:00Z' }] },
    [eventsRoute(OVERLAY, 7)]: { body: labeled('2026-11-09T00:00:00Z') },
  });
  const items = await collectInbox(github.client('read-token'));
  assert.deepEqual(
    items.map(({ repository, number, waitingSince }) => [repository, number, waitingSince]),
    [
      [WEB, 1, '2026-11-08T00:00:00Z'],
      [WEB, 2, '2026-10-01T00:00:00Z'],
      [OVERLAY, 7, '2026-11-09T00:00:00Z'],
    ],
  );
  assert.ok(github.calls.every((call) => call.method === 'GET' && call.auth === 'Bearer read-token'));
});

const emptyInbox = {
  [issueRoute(WEB)]: { body: [] },
  [issueRoute(OVERLAY)]: { body: [] },
};

test('run posts no comment when the inbox is empty, but still makes sure the digest issue exists', async () => {
  const read = fakeGitHub(emptyInbox);
  const write = fakeGitHub({ [digestListRoute]: { body: [{ number: 41, title: DIGEST_TITLE }] } });
  const logs = [];
  const posted = await run({ read: read.client('r'), write: write.client('w'), now: NOW, log: (line) => logs.push(line) });
  assert.equal(posted, null);
  assert.ok(write.calls.every((call) => call.method === 'GET'));
  assert.match(logs[0], /empty/);
});

const oneItem = {
  [issueRoute(WEB)]: { body: [{ number: 5, title: 'Decide', html_url: 'u5', created_at: '2026-11-08T14:00:00Z' }] },
  [eventsRoute(WEB, 5)]: { body: labeled('2026-11-08T14:00:00Z') },
  [issueRoute(OVERLAY)]: { body: [] },
};
const digestListRoute = `GET /repos/${WEB}/issues?labels=digest&state=all&per_page=100`;

test('run comments once on the existing digest issue, found by label and exact title', async () => {
  const read = fakeGitHub(oneItem);
  const write = fakeGitHub({
    [digestListRoute]: {
      body: [
        { number: 40, title: `${DIGEST_TITLE} (old draft)` },
        { number: 42, title: DIGEST_TITLE, pull_request: {} },
        { number: 41, title: DIGEST_TITLE },
      ],
    },
    [`POST /repos/${WEB}/issues/41/comments`]: { body: {} },
  });
  const comment = await run({ read: read.client('r'), write: write.client('w'), now: NOW, log: () => {} });
  const posts = write.calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.body, comment);
  assert.match(comment, /waiting 1 day\b/);
  assert.ok(write.calls.every((call) => call.auth === 'Bearer w'));
});

test('run creates the digest issue with the digest label alone, then pins it and comments', async () => {
  const read = fakeGitHub(oneItem);
  const write = fakeGitHub({
    [digestListRoute]: { body: [] },
    [`POST /repos/${WEB}/labels`]: { status: 422 },
    [`POST /repos/${WEB}/issues`]: { body: { number: 50, node_id: 'NODE' } },
    'POST /graphql': { body: { data: {} } },
    [`POST /repos/${WEB}/issues/50/comments`]: { body: {} },
  });
  const logs = [];
  await run({ read: read.client('r'), write: write.client('w'), now: NOW, log: (line) => logs.push(line) });
  const created = write.calls.find((call) => call.path === `/repos/${WEB}/issues`);
  assert.equal(created.body.title, DIGEST_TITLE);
  assert.deepEqual(created.body.labels, ['digest']);
  assert.equal(write.calls.find((call) => call.path === '/graphql').body.variables.id, 'NODE');
  assert.ok(!logs.some((line) => line.includes('not pinned')));
});

test('run still posts when pinning is refused, and says how to pin by hand', async () => {
  const read = fakeGitHub(oneItem);
  const write = fakeGitHub({
    [digestListRoute]: { body: [] },
    [`POST /repos/${WEB}/labels`]: { body: {} },
    [`POST /repos/${WEB}/issues`]: { body: { number: 50, node_id: 'NODE' } },
    'POST /graphql': { body: { errors: [{ message: 'Resource not accessible by integration' }] } },
    [`POST /repos/${WEB}/issues/50/comments`]: { body: {} },
  });
  const logs = [];
  await run({ read: read.client('r'), write: write.client('w'), now: NOW, log: (line) => logs.push(line) });
  assert.ok(write.calls.some((call) => call.path === `/repos/${WEB}/issues/50/comments`));
  assert.ok(logs.some((line) => line.includes('not pinned') && line.includes('Resource not accessible')));
});

test('a dry run prints the comment and writes nothing', async () => {
  const read = fakeGitHub(oneItem);
  const logs = [];
  const comment = await run({ read: read.client('r'), write: null, now: NOW, dryRun: true, log: (line) => logs.push(line) });
  assert.match(comment, /@anthonyturner, 1 item/);
  assert.ok(logs[0].startsWith('Dry run'));
});

test('the cost meter counts requests and reports what is left', async () => {
  const meter = createCostMeter('Read token');
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'x-ratelimit-remaining': '4990' }),
    json: async () => [],
  });
  await collectInbox(createClient({ token: 't', meter, fetchImpl }));
  assert.equal(meter.summary(), 'Read token REST cost: 2 request(s); 4990 remaining');
  assert.equal(createCostMeter('X').summary(), 'X REST cost: 0 request(s); unknown');
});
