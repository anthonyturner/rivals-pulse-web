// Tells Tony once a day what is waiting on him. Agents act as Tony's own GitHub account, so
// the `needs-tony` labels and questions they add never notify him: GitHub does not notify
// you about your own actions. This script reads every open `needs-tony` issue and pull
// request from both Rivals Pulse repositories and posts ONE comment listing them on a
// pinned digest issue, written by the workflow's GITHUB_TOKEN so it comes from
// github-actions[bot] and really does notify.
//
// Usage: node scripts/needs-tony-digest.mjs [--dry-run]
// Needs WORK_QUEUE_TOKEN (reads both repositories) and, unless --dry-run, GITHUB_TOKEN
// with `issues: write` on the web repository (finds or creates the digest issue, comments).
// Posts no comment when the inbox is empty.
import { pathToFileURL } from 'node:url';

export const WATCHED_REPOSITORIES = ['anthonyturner/rivals-pulse-web', 'anthonyturner/rivals_pulse'];
export const DIGEST_REPOSITORY = 'anthonyturner/rivals-pulse-web';
export const DIGEST_TITLE = 'Needs Tony digest';
export const DIGEST_LABEL = 'digest';
export const NEEDS_TONY_LABEL = 'needs-tony';
const OWNER_MENTION = '@anthonyturner';
const API = 'https://api.github.com';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const plural = (count, unit) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** A wait in plain words: "under an hour", "5 hours", "2 days 3 hours". Hours are dropped from a week on. */
export function formatWaited(milliseconds) {
  const hours = Math.floor(Math.max(0, milliseconds) / HOUR_MS);
  if (hours < 1) return 'under an hour';
  if (hours < 24) return plural(hours, 'hour');
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return days >= 7 || rest === 0 ? plural(days, 'day') : `${plural(days, 'day')} ${plural(rest, 'hour')}`;
}

/** When `needs-tony` was last added, from an issue's events (the label can come and go), or null. */
export function latestLabeledAt(events) {
  const times = events
    .filter((event) => event.event === 'labeled' && event.label?.name === NEEDS_TONY_LABEL)
    .map((event) => event.created_at)
    .sort();
  return times.at(-1) ?? null;
}

/** Item titles are untrusted text going into markdown: stop them from pinging anyone or breaking the list. */
const escapeTitle = (title) =>
  title
    .replace(/[\\`*_[\]<>|]/g, '\\$&')
    .replace(/@/g, '&#64;')
    .replace(/\s+/g, ' ')
    .trim();

/** The digest comment, longest wait first, or null when there is nothing to report. */
export function digestComment(items, now) {
  if (items.length === 0) return null;
  const lines = [...items]
    .sort((a, b) => a.waitingSince.localeCompare(b.waitingSince))
    .map(
      (item) =>
        `- ${item.repository}#${item.number} [${escapeTitle(item.title)}](${item.url}), waiting ${formatWaited(now - Date.parse(item.waitingSince))}`,
    );
  return [`${OWNER_MENTION}, ${plural(items.length, 'item')} waiting on you:`, '', ...lines].join('\n');
}

/**
 * What a client has spent of its REST budget. Each request costs 1 point of the token's
 * hourly allowance, and every response reports how much is left.
 */
export function createCostMeter(name) {
  let requests = 0;
  let remaining = null;
  return {
    record(headers) {
      requests += 1;
      const left = headers.get('x-ratelimit-remaining');
      if (left !== null) remaining = Number(left);
    },
    summary() {
      return `${name} REST cost: ${requests} request(s); ${remaining === null ? 'unknown' : `${remaining} remaining`}`;
    },
  };
}

/** A minimal REST client for one token. The token never leaves the Authorization header. */
export function createClient({ token, meter, fetchImpl = fetch }) {
  async function send(method, url, body) {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    meter.record(response.headers);
    if (!response.ok) {
      throw Object.assign(new Error(`${method} ${url.replace(API, '')} failed with ${response.status}`), {
        status: response.status,
      });
    }
    return response;
  }
  return {
    async request(method, path, body) {
      return (await send(method, `${API}${path}`, body)).json();
    },
    /** Every item of a list endpoint, following the Link header's next page. */
    async paginate(path) {
      const items = [];
      for (let url = `${API}${path}`; url; ) {
        const response = await send('GET', url);
        items.push(...(await response.json()));
        url = /<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1] ?? null;
      }
      return items;
    },
  };
}

/** Every open `needs-tony` issue and pull request of the watched repositories, with the time it started waiting. */
export async function collectInbox(read, repositories = WATCHED_REPOSITORIES) {
  const items = [];
  for (const repository of repositories) {
    const labeled = await read.paginate(
      `/repos/${repository}/issues?labels=${NEEDS_TONY_LABEL}&state=open&per_page=100`,
    );
    for (const issue of labeled) {
      const events = await read.paginate(`/repos/${repository}/issues/${issue.number}/events?per_page=100`);
      items.push({
        repository,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        waitingSince: latestLabeledAt(events) ?? issue.created_at,
      });
    }
  }
  return items;
}

const DIGEST_BODY = `This issue collects the daily "Needs Tony" digest. Every morning at 9:00 AM Eastern, the \`Needs Tony digest\` workflow posts one comment here listing the open issues and pull requests labelled \`needs-tony\` in both Rivals Pulse repositories, and how long each has waited. It comes from github-actions[bot], so it notifies the maintainer, which an agent's own label or comment cannot.

Keep this issue pinned and open, and never label it \`needs-tony\`.`;

/** GitHub rejects a label that already exists with a 422; that is the answer wanted. */
async function ensureDigestLabel(write) {
  try {
    await write.request('POST', `/repos/${DIGEST_REPOSITORY}/labels`, {
      name: DIGEST_LABEL,
      color: '5319e7',
      description: 'The daily Needs Tony digest issue',
    });
  } catch (error) {
    if (error.status !== 422) throw error;
  }
}

/** Null when the issue is pinned, else why not. GraphQL reports a refusal as a 200 with an errors list. */
async function pinIssue(write, nodeId) {
  try {
    const { errors } = await write.request('POST', '/graphql', {
      query: 'mutation($id: ID!) { pinIssue(input: { issueId: $id }) { issue { id } } }',
      variables: { id: nodeId },
    });
    return errors?.length ? errors.map((error) => error.message).join('; ') : null;
  } catch (error) {
    return error.message;
  }
}

/** The digest issue's number, creating and pinning it the first time. Found by label and exact title, never by search. */
export async function ensureDigestIssue(write, log) {
  const labeled = await write.paginate(
    `/repos/${DIGEST_REPOSITORY}/issues?labels=${DIGEST_LABEL}&state=all&per_page=100`,
  );
  const existing = labeled.find((issue) => !issue.pull_request && issue.title === DIGEST_TITLE);
  if (existing) return existing.number;

  await ensureDigestLabel(write);
  const created = await write.request('POST', `/repos/${DIGEST_REPOSITORY}/issues`, {
    title: DIGEST_TITLE,
    body: DIGEST_BODY,
    labels: [DIGEST_LABEL],
  });
  log(`Created the digest issue #${created.number}.`);
  const notPinned = await pinIssue(write, created.node_id);
  if (notPinned !== null) {
    log(`::warning title=Digest issue not pinned::${notPinned}. Pin issue #${created.number} by hand once.`);
  }
  return created.number;
}

/**
 * Reads the inbox and, when it holds anything, posts the digest. The digest issue is made sure
 * of even on an empty day, so it exists and can be pinned before the first digest needs it.
 * Returns the comment, or null when nothing was posted.
 */
export async function run({ read, write, now = Date.now(), dryRun = false, log = console.log }) {
  const items = await collectInbox(read);
  const comment = digestComment(items, now);
  if (dryRun) {
    log(comment ? `Dry run, not posting:
${comment}` : 'Dry run: the Needs Tony inbox is empty.');
    return comment;
  }
  const number = await ensureDigestIssue(write, log);
  if (!comment) {
    log('The Needs Tony inbox is empty; nothing to post.');
    return null;
  }
  await write.request('POST', `/repos/${DIGEST_REPOSITORY}/issues/${number}/comments`, { body: comment });
  log(`Posted a digest of ${plural(items.length, 'item')} on issue #${number}.`);
  return comment;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes('--dry-run');
  const readMeter = createCostMeter('Read token');
  const writeMeter = createCostMeter('Write token');
  try {
    await run({
      read: createClient({ token: requireEnv('WORK_QUEUE_TOKEN'), meter: readMeter }),
      write: dryRun ? null : createClient({ token: requireEnv('GITHUB_TOKEN'), meter: writeMeter }),
      dryRun,
    });
  } finally {
    console.log(readMeter.summary());
    if (!dryRun) console.log(writeMeter.summary());
  }
}
