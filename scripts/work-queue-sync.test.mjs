import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MIN_REMAINING_POINTS,
  createCostMeter,
  desiredStatus,
  issueArgument,
  iterationConfiguration,
  iterationOn,
  missingIterations,
  shouldStandDown,
  workStartedOn,
} from './work-queue-sync.mjs';

const issue = ({ labels = [], pullRequests = [] } = {}) => ({
  labels: { nodes: labels.map((name) => ({ name })) },
  closedByPullRequestsReferences: { nodes: pullRequests },
});
const openPr = { state: 'OPEN', isDraft: false };
const draftPr = { state: 'OPEN', isDraft: true };
const mergedPr = { state: 'MERGED', isDraft: false };

test('needs-tony wins over an open pull request and the ready label', () => {
  assert.equal(desiredStatus(issue({ labels: ['needs-tony', 'ready'], pullRequests: [openPr] })), 'Needs Tony');
});

test('an open non-draft closing pull request means In review, even beside a draft', () => {
  assert.equal(desiredStatus(issue({ pullRequests: [draftPr, openPr] })), 'In review');
});

test('only an open draft closing pull request means Agent working', () => {
  assert.equal(desiredStatus(issue({ labels: ['ready'], pullRequests: [draftPr] })), 'Agent working');
});

test('the ready label without an open pull request means Ready', () => {
  assert.equal(desiredStatus(issue({ labels: ['ready'], pullRequests: [mergedPr] })), 'Ready');
});

test('any other open issue is Backlog', () => {
  assert.equal(desiredStatus(issue({ labels: ['bug'] })), 'Backlog');
});

const pr = (state, createdAt) => ({ state, isDraft: false, createdAt });
const weeks = [
  { id: 'a', title: 'Week of Nov 9', startDate: '2026-11-09', duration: 7 },
  { id: 'b', title: 'Week of Nov 16', startDate: '2026-11-16', duration: 7 },
];

test('work starts with the earliest open or merged closing pull request, ignoring closed ones', () => {
  const pullRequests = [pr('OPEN', '2026-11-12T10:00:00Z'), pr('CLOSED', '2026-11-01T00:00:00Z'), pr('MERGED', '2026-11-10T23:00:00Z')];
  assert.equal(workStartedOn(issue({ pullRequests })), '2026-11-10');
  assert.equal(workStartedOn(issue({ pullRequests: [pr('CLOSED', '2026-11-12T00:00:00Z')] })), null);
});

test('a date maps to the iteration that holds it, and to none before the first', () => {
  assert.equal(iterationOn('2026-11-15', weeks)?.id, 'a');
  assert.equal(iterationOn('2026-11-16', weeks)?.id, 'b');
  assert.equal(iterationOn('2026-11-08', weeks), null);
  assert.equal(iterationOn('2026-11-23', weeks), null);
});

test('nothing is added while the current and next week exist', () => {
  assert.deepEqual(missingIterations(weeks, '2026-11-09'), []);
});

test('missing weeks are appended so the current and next week exist', () => {
  assert.deepEqual(missingIterations(weeks, '2026-11-18'), [
    { title: 'Week of Nov 23', startDate: '2026-11-23', duration: 7 },
  ]);
  assert.deepEqual(
    missingIterations(weeks, '2026-12-01').map((iteration) => iteration.title),
    ['Week of Nov 23', 'Week of Nov 30', 'Week of Dec 7'],
  );
});

test('extending sends every existing iteration back with its id, completed ones included', () => {
  const completed = { id: 'old', title: 'Week of Nov 2', startDate: '2026-11-02', duration: 7 };
  const added = { title: 'Week of Nov 23', startDate: '2026-11-23', duration: 7 };
  assert.deepEqual(iterationConfiguration([...weeks, completed], [added]), {
    startDate: '2026-11-02',
    duration: 7,
    iterations: [completed, ...weeks, added],
  });
});

test('the cost meter adds query costs, counts each mutation as a point and keeps the latest remaining budget', () => {
  const meter = createCostMeter();
  meter.recordQuery({ cost: 1, remaining: 4999 });
  meter.recordQuery({ cost: 3, remaining: 4996 });
  meter.recordMutation();
  meter.recordMutation();
  assert.equal(meter.remaining, 4996);
  assert.equal(meter.summary(), 'GraphQL cost: 6 point(s) (2 queries, 2 mutation(s)); 4996 remaining');
});

test('the cost meter reports an unknown budget before any query has answered', () => {
  assert.equal(createCostMeter().summary(), 'GraphQL cost: 0 point(s) (0 queries, 0 mutation(s)); unknown');
});

test('the sync stands down only when the known budget is below the floor', () => {
  assert.equal(shouldStandDown(MIN_REMAINING_POINTS - 1), true);
  assert.equal(shouldStandDown(MIN_REMAINING_POINTS), false);
  assert.equal(shouldStandDown(null), false);
});

test('--issue selects a single-issue sync and its absence a full sweep', () => {
  assert.equal(issueArgument(['node', 'sync.mjs', '--apply']), null);
  assert.equal(issueArgument(['node', 'sync.mjs', '--apply', '--issue', 'I_kwDOabc']), 'I_kwDOabc');
  assert.throws(() => issueArgument(['node', 'sync.mjs', '--issue']), /node id/);
  assert.throws(() => issueArgument(['node', 'sync.mjs', '--issue', '--apply']), /node id/);
});
