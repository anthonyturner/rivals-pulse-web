// Records Tony's answer to a Needs Tony item. The "Record Tony's answer" workflow runs it for
// every new comment on an issue labelled `needs-tony`; see docs/agent-workflows/tony-answers.md.
//
// Usage: node scripts/tony-answer.mjs [--apply] [--event <file>]
// Dry run by default. --event defaults to $GITHUB_EVENT_PATH. --apply needs `gh` and a GH_TOKEN
// that can write issues.
//
// The comment text is only ever data here: it is matched against fixed words and never run,
// evaluated or put into a command line. A comment that counts as an answer swaps the label
// `needs-tony` for `tony-answered` and gets a reaction. Nothing here merges or pushes.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { SLACK_ANSWER_MARKER_PATTERN } from '../src/server/slack-answer/answer-comment.ts';

const run = promisify(execFile);

export const NEEDS_TONY = 'needs-tony';
export const TONY_ANSWERED = 'tony-answered';

/** Agents act as the maintainer's own GitHub account, so the author cannot tell Tony from an agent. Agents sign their comments instead. */
export const AGENT_MARKER = '<!-- agent -->';
/** The bare marker, or the named form a callsigned agent writes: `<!-- agent: vega -->`. */
export const AGENT_MARKER_PATTERN = /<!--\s*agent(?::\s*[a-z0-9-]+)?\s*-->/i;
const AGENT_SIGNATURES = [AGENT_MARKER_PATTERN, /^\s*waiting on tony:/i, /generated with \[claude code\]/i];

const APPROVE_WORDS = new Set(['approve', 'approved', 'merge', 'yes', 'lgtm', 'ship']);
const HOLD_WORDS = new Set(['no', 'hold', 'stop', 'wait', 'reject']);
const MAX_VOCABULARY_WORDS = 4;

/** True for a comment an agent wrote: signed, or the question itself. */
export function isAgentComment(body) {
  return AGENT_SIGNATURES.some((signature) => signature.test(body ?? ''));
}

/** What Tony wrote, without the signed footer the Slack route adds and without hidden comments. */
export function visibleAnswer(body) {
  const beforeSlackFooter = (body ?? '').split(SLACK_ANSWER_MARKER_PATTERN)[0];

  return beforeSlackFooter.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * `approve`, `hold` or `free-text`. Only a short comment led by a vocabulary word is
 * recognised ("merge 714", "no", "approve please"); anything longer is Tony explaining
 * himself, which an agent has to read in full whatever its first word is.
 */
export function answerKind(body) {
  const text = visibleAnswer(body);
  if (text === '👍') return 'approve';
  if (text === '👎') return 'hold';

  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (words.length === 0 || words.length > MAX_VOCABULARY_WORDS) return 'free-text';
  if (APPROVE_WORDS.has(words[0])) return 'approve';
  if (HOLD_WORDS.has(words[0])) return 'hold';

  return 'free-text';
}

const REACTIONS = { approve: '+1', hold: 'eyes', 'free-text': 'eyes' };

/** Whether an issue_comment event is Tony answering a Needs Tony item: `{ record: true, kind }` or `{ record: false, reason }`. */
export function decide(event) {
  const comment = event?.comment;
  const issue = event?.issue;
  if (event?.action !== 'created' || !comment || !issue) return { record: false, reason: 'not a new comment' };

  const owner = event.repository?.owner?.login;
  if (!owner || comment.user?.type !== 'User' || comment.user.login?.toLowerCase() !== owner.toLowerCase()) {
    return { record: false, reason: 'not the repository owner' };
  }
  if (issue.state !== 'open') return { record: false, reason: 'issue is not open' };
  if (!(issue.labels ?? []).some((label) => label.name === NEEDS_TONY)) {
    return { record: false, reason: `issue is not labelled ${NEEDS_TONY}` };
  }
  if (isAgentComment(comment.body)) return { record: false, reason: 'written by an agent' };
  if (visibleAnswer(comment.body) === '') return { record: false, reason: 'empty comment' };

  return { record: true, kind: answerKind(comment.body) };
}

/**
 * Applies a recorded answer through `api(method, path, fields)`. The new label goes on before the old
 * one comes off, so the issue is never without both. The reaction is a courtesy and cannot fail the run.
 */
export async function record(event, kind, api) {
  const repository = event.repository.full_name;
  const labels = `/repos/${repository}/issues/${event.issue.number}/labels`;

  await api('POST', labels, { 'labels[]': TONY_ANSWERED });
  try {
    await api('DELETE', `${labels}/${NEEDS_TONY}`);
  } catch (error) {
    if (!/404|Label does not exist/i.test(String(error?.stderr ?? error))) throw error;
  }
  try {
    await api('POST', `/repos/${repository}/issues/comments/${event.comment.id}/reactions`, {
      content: REACTIONS[kind],
    });
  } catch (error) {
    console.warn(`::warning title=Reaction not added::${String(error?.message ?? error).split('\n')[0]}`);
  }
}

/** `gh api` with fixed arguments, never a shell. */
async function ghApi(method, path, fields = {}) {
  const args = ['api', '--method', method, path];
  for (const [name, value] of Object.entries(fields)) args.push('-f', `${name}=${value}`);
  await run('gh', args);
}

async function main(argv) {
  const eventIndex = argv.indexOf('--event');
  const eventPath = eventIndex >= 0 ? argv[eventIndex + 1] : process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('No event file: pass --event <file> or set GITHUB_EVENT_PATH.');

  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const decision = decide(event);
  if (!decision.record) {
    console.log(`Ignored: ${decision.reason}.`);
    return;
  }

  console.log(`Tony's answer on issue ${event.issue.number}: ${decision.kind}.`);
  if (!argv.includes('--apply')) {
    console.log('Dry run: pass --apply to change the labels.');
    return;
  }
  await record(event, decision.kind, ghApi);
  console.log(`Swapped ${NEEDS_TONY} for ${TONY_ANSWERED}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
