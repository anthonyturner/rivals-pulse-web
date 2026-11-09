import assert from 'node:assert/strict';
import { test } from 'node:test';
import { desiredStatus } from './work-queue-sync.mjs';

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
