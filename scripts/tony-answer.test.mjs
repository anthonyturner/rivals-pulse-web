import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slackAnswerComment } from '../src/server/slack-answer/answer-comment.ts';
import {
  AGENT_MARKER,
  answerKind,
  decide,
  isAgentComment,
  record,
  visibleAnswer,
} from './tony-answer.mjs';

const event = ({ body = 'approve', login = 'anthonyturner', type = 'User', labels = ['needs-tony'], state = 'open', action = 'created' } = {}) => ({
  action,
  repository: { full_name: 'anthonyturner/rivals-pulse-web', owner: { login: 'anthonyturner' } },
  issue: { number: 721, state, labels: labels.map((name) => ({ name })) },
  comment: { id: 99, body, user: { login, type } },
});

test("the owner's comment on a needs-tony issue is an answer", () => {
  assert.deepEqual(decide(event({ body: 'approve' })), { record: true, kind: 'approve' });
});

test('anyone else, a bot or a new login is ignored', () => {
  assert.equal(decide(event({ login: 'someone-else' })).record, false);
  assert.equal(decide(event({ login: 'github-actions[bot]', type: 'Bot' })).record, false);
  assert.equal(decide(event({ login: 'anthonyturner', type: 'Bot' })).record, false);
});

test('the owner is matched without regard to case', () => {
  assert.equal(decide(event({ login: 'AnthonyTurner' })).record, true);
});

test('an issue without needs-tony, or a closed one, is ignored', () => {
  assert.equal(decide(event({ labels: ['ready'] })).record, false);
  assert.equal(decide(event({ labels: ['tony-answered'] })).record, false);
  assert.equal(decide(event({ state: 'closed' })).record, false);
});

test('only a new comment counts, not an edit or a delete', () => {
  assert.equal(decide(event({ action: 'edited' })).record, false);
  assert.equal(decide(event({ action: 'deleted' })).record, false);
});

test('an agent comment posted from the owner account is ignored', () => {
  assert.equal(decide(event({ body: `${AGENT_MARKER}\nStarted work on this.` })).record, false);
  assert.equal(decide(event({ body: 'Waiting on Tony: merge 714?\n\nMy recommendation: yes.' })).record, false);
  assert.equal(decide(event({ body: '  waiting on tony: which one?' })).record, false);
  assert.equal(decide(event({ body: 'Review.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)' })).record, false);
});

test('a comment that only mentions the marker words later is still read as an answer', () => {
  assert.equal(decide(event({ body: 'no, I am not waiting on Tony: I decided' })).record, true);
});

test('an empty comment, or one that is only hidden markup, is ignored', () => {
  assert.equal(decide(event({ body: '   ' })).record, false);
  assert.equal(decide(event({ body: '<!-- note -->' })).record, false);
});

test('a malformed event is ignored, not thrown on', () => {
  assert.equal(decide({}).record, false);
  assert.equal(decide(undefined).record, false);
  assert.equal(decide({ action: 'created', comment: { body: 'yes' }, issue: { labels: [] } }).record, false);
});

test('approve and hold words are recognised, in any case and with a reference', () => {
  for (const body of ['approve', 'Approved', 'MERGE', 'merge 714', 'yes.', 'lgtm', 'approve please', '👍']) {
    assert.equal(answerKind(body), 'approve', body);
  }
  for (const body of ['no', 'No.', 'hold', 'hold off', 'stop', 'reject it', '👎']) {
    assert.equal(answerKind(body), 'hold', body);
  }
});

test('anything else, or anything long, is a free-text answer', () => {
  assert.equal(answerKind('use the second option'), 'free-text');
  assert.equal(answerKind('no, because the design drops the sound toggle'), 'free-text');
  assert.equal(answerKind('approve\n\nbut rename the label first and then merge it'), 'free-text');
  assert.equal(answerKind(''), 'free-text');
  assert.equal(answerKind('🙂'), 'free-text');
});

test('the Slack footer and hidden comments do not change what the answer says', () => {
  const body = slackAnswerComment('merge 714', '1731158400.000200');
  assert.equal(visibleAnswer(body), 'merge 714');
  assert.equal(answerKind(body), 'approve');
  assert.equal(decide(event({ body })).record, true);
});

test('isAgentComment tolerates a missing body', () => {
  assert.equal(isAgentComment(undefined), false);
  assert.equal(isAgentComment('<!--agent-->'), true);
});

const recorder = (failures = {}) => {
  const calls = [];
  const api = async (method, path, fields = {}) => {
    calls.push({ method, path, fields });
    const failure = failures[method + ' ' + path.split('/').slice(-1)[0]];
    if (failure) throw failure;
  };
  return { calls, api };
};

test('recording an answer adds tony-answered, removes needs-tony and reacts', async () => {
  const { calls, api } = recorder();
  await record(event({ body: 'merge' }), 'approve', api);

  assert.deepEqual(calls, [
    { method: 'POST', path: '/repos/anthonyturner/rivals-pulse-web/issues/721/labels', fields: { 'labels[]': 'tony-answered' } },
    { method: 'DELETE', path: '/repos/anthonyturner/rivals-pulse-web/issues/721/labels/needs-tony', fields: {} },
    { method: 'POST', path: '/repos/anthonyturner/rivals-pulse-web/issues/comments/99/reactions', fields: { content: '+1' } },
  ]);
});

test('a hold and a free-text answer react with eyes', async () => {
  for (const kind of ['hold', 'free-text']) {
    const { calls, api } = recorder();
    await record(event(), kind, api);
    assert.equal(calls.at(-1).fields.content, 'eyes');
  }
});

test('a label that is already gone is not an error', async () => {
  const { api } = recorder({ 'DELETE needs-tony': Object.assign(new Error('x'), { stderr: 'gh: Label does not exist (HTTP 404)' }) });
  await record(event(), 'approve', api);
});

test('a failed label change fails the run, and a failed reaction does not', async () => {
  const labelFailure = recorder({ 'POST labels': new Error('boom') });
  await assert.rejects(record(event(), 'approve', labelFailure.api), /boom/);

  const removeFailure = recorder({ 'DELETE needs-tony': Object.assign(new Error('x'), { stderr: 'HTTP 500' }) });
  await assert.rejects(record(event(), 'approve', removeFailure.api));

  const reactionFailure = recorder({ 'POST reactions': new Error('no reaction') });
  await record(event(), 'approve', reactionFailure.api);
});
