// Keeps the "Rivals Pulse Work Queue" board (GitHub user Project 2) in step with
// the open issues of both Rivals Pulse repositories. The board is a computed view
// (overlay ADR-0024): every card's Status, Iteration and Agent is derived here, and
// nobody sets them by hand.
//
// Usage: node scripts/work-queue-sync.mjs [--apply] [--issue <node id>]
// Dry run by default. Needs `gh` and a GH_TOKEN with `repo` and `project` scopes.
// Without --issue it sweeps every open issue of both repositories (the scheduled run).
// With --issue it syncs that one issue and nothing else (an issue event), at a
// small fraction of the cost, so a burst of events cannot drain the shared API budget.
//
// The Agent text field must exist on the project. Create it once with:
//   gh api graphql -f project=<project node id> -f query='mutation($project: ID!) {
//     createProjectV2Field(input: { projectId: $project, dataType: TEXT, name: "Agent" }) {
//       projectV2Field { ... on ProjectV2Field { id name dataType } } } }'
// GitHub's API cannot add a field as a column to a view, so that stays a click in each view.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PROJECT_OWNER = 'anthonyturner';
const PROJECT_NUMBER = 2;
const PROJECT_TITLE = 'Rivals Pulse Work Queue';
const STATUS_FIELD = 'Status';
const ITERATION_FIELD = 'Iteration';
const AGENT_FIELD = 'Agent';
const ITERATION_DAYS = 7;
const DAY_MS = 86_400_000;
/** How many of the newest comments are read for an agent marker; GitHub prices a comment connection by request, not by size. */
const ISSUE_COMMENTS = 10;
const PULL_REQUEST_COMMENTS = 20;
/** Pull requests per comment lookup, so one lookup stays within a single GraphQL point. */
const COMMENT_BATCH_SIZE = 40;
const REPOSITORIES = ['anthonyturner/rivals_pulse', 'anthonyturner/rivals-pulse-web'];
/** The agents share this token's hourly GraphQL budget, so the sync stands down below this many points left. */
export const MIN_REMAINING_POINTS = 500;

/** Every status this script can assign. Closed issues are moved to Done by the project's own "Item closed" workflow. */
export const STATUSES = ['Needs Tony', 'In review', 'Agent working', 'Ready', 'Backlog'];

const openClosingPullRequests = (issue) =>
  issue.closedByPullRequestsReferences.nodes.filter((pullRequest) => pullRequest.state === 'OPEN');

/** The board status an open issue should have. The first rule that matches wins. */
export function desiredStatus(issue) {
  const labels = issue.labels.nodes.map((label) => label.name);
  const openPullRequests = openClosingPullRequests(issue);
  if (labels.includes('needs-tony')) return 'Needs Tony';
  if (openPullRequests.some((pullRequest) => !pullRequest.isDraft)) return 'In review';
  if (openPullRequests.length > 0) return 'Agent working';
  if (labels.includes('ready')) return 'Ready';
  return 'Backlog';
}

/** The date (YYYY-MM-DD) work on an open issue started: its earliest open or merged closing pull request, or null. */
export function workStartedOn(issue) {
  const created = issue.closedByPullRequestsReferences.nodes
    .filter((pullRequest) => pullRequest.state === 'OPEN' || pullRequest.state === 'MERGED')
    .map((pullRequest) => pullRequest.createdAt)
    .sort();
  return created.length > 0 ? created[0].slice(0, 10) : null;
}

const capitalise = (name) => name[0].toUpperCase() + name.slice(1).toLowerCase();

/**
 * The agent a body or comment is signed with: the last `<!-- agent: <name> -->` in the text,
 * capitalised like the roster writes it, or null. The unnamed `<!-- agent -->` form is a valid
 * signature that names nobody.
 */
export function agentNameIn(text) {
  const names = [...(text ?? '').matchAll(/<!--\s*agent\s*:\s*([A-Za-z][\w-]*)\s*-->/gi)];
  return names.length > 0 ? capitalise(names.at(-1)[1]) : null;
}

/** The name on the newest of the comments that carries one, or null. */
function newestAgentIn(comments = []) {
  const newestFirst = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const comment of newestFirst) {
    const name = agentNameIn(comment.body);
    if (name) return name;
  }
  return null;
}

/** The pull request's own signature wins; its comments are read only when the body names nobody. */
const pullRequestAgent = (pullRequest) => agentNameIn(pullRequest.body) ?? newestAgentIn(pullRequest.comments?.nodes);

/**
 * The agent holding an issue: the newest open closing pull request that names one (its body, then
 * its comments), otherwise the issue's newest comment that names one, otherwise null.
 */
export function agentFor(issue) {
  const newestFirst = [...openClosingPullRequests(issue)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const pullRequest of newestFirst) {
    const name = pullRequestAgent(pullRequest);
    if (name) return name;
  }
  return newestAgentIn(issue.comments?.nodes);
}

/** The open closing pull requests whose comments still have to be fetched to learn the agent. */
export const pullRequestsAwaitingComments = (issue) =>
  openClosingPullRequests(issue).filter((pullRequest) => !pullRequest.comments && !agentNameIn(pullRequest.body));

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The iteration whose range holds the date, or null when none does (e.g. before the first iteration). */
export function iterationOn(date, iterations) {
  return (
    iterations.find((iteration) => iteration.startDate <= date && date < addDays(iteration.startDate, iteration.duration)) ??
    null
  );
}

/**
 * The iterations to append so the current and the next week exist, each 7 days long
 * and following on from the last iteration. Empty when nothing is missing.
 */
export function missingIterations(iterations, today) {
  const sorted = [...iterations].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last = sorted.at(-1);
  if (!last) throw new Error(`"${ITERATION_FIELD}" has no iterations to extend.`);
  // Iterations are contiguous, so ending after next week's same weekday covers both weeks.
  const needThrough = addDays(today, ITERATION_DAYS);
  const added = [];
  for (let next = addDays(last.startDate, last.duration); next <= needThrough; next = addDays(next, ITERATION_DAYS)) {
    added.push({ title: weekTitle(next), startDate: next, duration: ITERATION_DAYS });
  }
  return added;
}

const weekTitle = (date) =>
  `Week of ${new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

/**
 * What a run has spent of the GraphQL budget. Queries report their own cost through
 * `rateLimit`; a mutation exposes none, so it is counted at the 1 point GitHub charges it.
 */
export function createCostMeter() {
  let queries = 0;
  let mutations = 0;
  let points = 0;
  let remaining = null;
  return {
    recordQuery(rateLimit) {
      queries += 1;
      if (!rateLimit) return;
      points += rateLimit.cost;
      remaining = rateLimit.remaining;
    },
    recordMutation() {
      mutations += 1;
      points += 1;
    },
    get remaining() {
      return remaining;
    },
    summary() {
      const left = remaining === null ? 'unknown' : `${remaining} remaining`;
      return `GraphQL cost: ${points} point(s) (${queries} quer${queries === 1 ? 'y' : 'ies'}, ${mutations} mutation(s)); ${left}`;
    },
  };
}

/** True when so little budget is left that the sync should leave it to the agents. */
export const shouldStandDown = (remaining) => remaining !== null && remaining < MIN_REMAINING_POINTS;

const meter = createCostMeter();
const RATE_LIMIT = 'rateLimit { cost remaining }';

function graphql(query, variables = {}) {
  const isMutation = query.trimStart().startsWith('mutation');
  const body = JSON.stringify({ query, variables });
  const response = JSON.parse(
    execFileSync('gh', ['api', 'graphql', '--input', '-'], { input: body, encoding: 'utf8', maxBuffer: 64e6 }),
  );
  if (response.errors) throw new Error(response.errors.map((error) => error.message).join('; '));
  if (isMutation) meter.recordMutation();
  else meter.recordQuery(response.data.rateLimit);
  return response.data;
}

function findBoard() {
  const { user } = graphql(
    `query($owner: String!, $number: Int!, $status: String!, $iteration: String!, $agent: String!) {
      ${RATE_LIMIT}
      user(login: $owner) { projectV2(number: $number) {
        id title
        status: field(name: $status) { ... on ProjectV2SingleSelectField { id options { id name } } }
        iteration: field(name: $iteration) { ... on ProjectV2IterationField { id configuration {
          iterations { id title startDate duration }
          completedIterations { id title startDate duration }
        } } }
        agent: field(name: $agent) { ... on ProjectV2Field { id } }
      } }
    }`,
    { owner: PROJECT_OWNER, number: PROJECT_NUMBER, status: STATUS_FIELD, iteration: ITERATION_FIELD, agent: AGENT_FIELD },
  );
  const project = user?.projectV2;
  if (project?.title !== PROJECT_TITLE) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} is not "${PROJECT_TITLE}".`);
  }
  if (!project.status?.id) throw new Error(`"${PROJECT_TITLE}" has no single-select "${STATUS_FIELD}" field.`);
  if (!project.iteration?.id) throw new Error(`"${PROJECT_TITLE}" has no iteration field "${ITERATION_FIELD}".`);
  const optionIds = Object.fromEntries(project.status.options.map((option) => [option.name, option.id]));
  const missing = STATUSES.filter((status) => !optionIds[status]);
  if (missing.length > 0) throw new Error(`"${STATUS_FIELD}" is missing options: ${missing.join(', ')}.`);
  const { iterations, completedIterations } = project.iteration.configuration;
  return {
    projectId: project.id,
    statusFieldId: project.status.id,
    optionIds,
    iterationFieldId: project.iteration.id,
    // The board predates this field, so a missing one skips the Agent column instead of failing the sync.
    agentFieldId: project.agent?.id ?? null,
    iterations: [...completedIterations, ...iterations].sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}

/**
 * The configuration that appends `added` to the field. GitHub replaces the whole list,
 * so every existing iteration, completed ones included, goes back with its id.
 */
export function iterationConfiguration(existing, added) {
  const iterations = [...existing, ...added]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(({ id, title, startDate, duration }) => (id ? { id, title, startDate, duration } : { title, startDate, duration }));
  return { startDate: iterations[0].startDate, duration: ITERATION_DAYS, iterations };
}

/** Appends iterations to the field, and throws if GitHub dropped any existing one. */
function extendIterations(board, added) {
  const field = graphql(
    `mutation($field: ID!, $configuration: ProjectV2IterationFieldConfigurationInput!) {
      updateProjectV2Field(input: { fieldId: $field, iterationConfiguration: $configuration }) {
        projectV2Field { ... on ProjectV2IterationField { configuration {
          iterations { id title startDate duration }
          completedIterations { id title startDate duration }
        } } }
      }
    }`,
    { field: board.iterationFieldId, configuration: iterationConfiguration(board.iterations, added) },
  ).updateProjectV2Field.projectV2Field.configuration;
  const kept = [...field.completedIterations, ...field.iterations];
  const lost = board.iterations.filter((iteration) => !kept.some((k) => k.id === iteration.id));
  if (lost.length > 0) throw new Error(`Extending "${ITERATION_FIELD}" dropped iterations: ${lost.map((i) => i.title).join(', ')}.`);
  board.iterations = kept.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

const COMMENT_FIELDS = 'nodes { body createdAt }';

/**
 * The fields the mapping reads from an issue, shared by the sweep and the single-issue query.
 * GitHub prices a query by its connections, one request per parent node. Nesting comments under
 * every closing pull request of 100 issues would add up to 10 points a page, so only the
 * single-issue query nests them (its whole cost stays one point); the sweep fetches them
 * afterwards for just the pull requests that need them.
 */
const issueFields = ({ pullRequestComments }) => `
  id number
  labels(first: 50) { nodes { name } }
  comments(last: ${ISSUE_COMMENTS}) { ${COMMENT_FIELDS} }
  closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes {
    id state isDraft createdAt body
    ${pullRequestComments ? `comments(last: ${PULL_REQUEST_COMMENTS}) { ${COMMENT_FIELDS} }` : ''}
  } }
  projectItems(first: 20) { nodes {
    id project { id }
    status: fieldValueByName(name: "${STATUS_FIELD}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    iteration: fieldValueByName(name: "${ITERATION_FIELD}") { ... on ProjectV2ItemFieldIterationValue { title } }
    agent: fieldValueByName(name: "${AGENT_FIELD}") { ... on ProjectV2ItemFieldTextValue { text } }
  } }`;

function openIssues(repository) {
  const [owner, name] = repository.split('/');
  const issues = [];
  let after = null;
  do {
    const { repository: repo } = graphql(
      `query($owner: String!, $name: String!, $after: String) {
        ${RATE_LIMIT}
        repository(owner: $owner, name: $name) { issues(states: OPEN, first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${issueFields({ pullRequestComments: false })} }
        } }
      }`,
      { owner, name, ...(after ? { after } : {}) },
    );
    issues.push(...repo.issues.nodes.map((issue) => ({ ...issue, repository })));
    after = repo.issues.pageInfo.hasNextPage ? repo.issues.pageInfo.endCursor : null;
  } while (after);
  return issues;
}

/** One issue by node id, or null when it is closed, not an issue, or not in a tracked repository. */
function findOpenIssue(nodeId) {
  const { node } = graphql(
    `query($id: ID!) {
      ${RATE_LIMIT}
      node(id: $id) { ... on Issue { state repository { nameWithOwner } ${issueFields({ pullRequestComments: true })} } }
    }`,
    { id: nodeId },
  );
  if (node?.state !== 'OPEN' || !REPOSITORIES.includes(node.repository.nameWithOwner)) return null;
  return { ...node, repository: node.repository.nameWithOwner };
}

/** Fetches the comments of the pull requests whose body names no agent, a batch of them per query. */
function loadPullRequestComments(issues) {
  const awaiting = issues.flatMap(pullRequestsAwaitingComments);
  for (let from = 0; from < awaiting.length; from += COMMENT_BATCH_SIZE) {
    const batch = awaiting.slice(from, from + COMMENT_BATCH_SIZE);
    const lookups = batch.map(
      (_, at) => `p${at}: node(id: $id${at}) { ... on PullRequest { comments(last: ${PULL_REQUEST_COMMENTS}) { ${COMMENT_FIELDS} } } }`,
    );
    const data = graphql(
      `query(${batch.map((_, at) => `$id${at}: ID!`).join(', ')}) {
        ${RATE_LIMIT}
        ${lookups.join(' ')}
      }`,
      Object.fromEntries(batch.map((pullRequest, at) => [`id${at}`, pullRequest.id])),
    );
    batch.forEach((pullRequest, at) => {
      pullRequest.comments = data[`p${at}`].comments;
    });
  }
}

function addToBoard(board, issue) {
  return graphql(
    `mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
    }`,
    { project: board.projectId, content: issue.id },
  ).addProjectV2ItemById.item.id;
}

function setField(board, itemId, fieldId, value) {
  graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $value: ProjectV2FieldValue!) {
      updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field, value: $value }) {
        clientMutationId
      }
    }`,
    { project: board.projectId, item: itemId, field: fieldId, value },
  );
}

/** Brings one open issue's card in line with its labels, pull requests and agent signatures, adding the card when it is missing. */
function syncIssue(board, issue, { apply, report }) {
  const label = `${issue.repository}#${issue.number}`;
  const item = issue.projectItems.nodes.find((node) => node.project.id === board.projectId);
  let itemId = item?.id;
  const ensureItem = () => (itemId ??= addToBoard(board, issue));

  const currentStatus = item?.status?.name ?? null;
  const wantedStatus = desiredStatus(issue);
  if (currentStatus !== wantedStatus) {
    if (apply) setField(board, ensureItem(), board.statusFieldId, { singleSelectOptionId: board.optionIds[wantedStatus] });
    report(`${label}: Status ${currentStatus ?? '(not on board)'} -> ${wantedStatus}`);
  }

  // An issue keeps the week its work started, so a set iteration is never changed.
  if (!item?.iteration) {
    const startedOn = workStartedOn(issue);
    const iteration = startedOn && iterationOn(startedOn, board.iterations);
    if (iteration) {
      if (apply) setField(board, ensureItem(), board.iterationFieldId, { iterationId: iteration.id });
      report(`${label}: ${ITERATION_FIELD} -> ${iteration.title}`);
    }
  }

  // No signature found means the field keeps whatever it holds: a marker that has scrolled out of the
  // newest comments must not wipe an agent that was already recorded.
  const agent = board.agentFieldId && agentFor(issue);
  if (agent && agent !== item?.agent?.text) {
    if (apply) setField(board, ensureItem(), board.agentFieldId, { text: agent });
    report(`${label}: ${AGENT_FIELD} ${item?.agent?.text ?? '(blank)'} -> ${agent}`);
  }
}

function sync({ apply, issueNodeId, today = new Date().toISOString().slice(0, 10) }) {
  const board = findBoard();
  if (shouldStandDown(meter.remaining)) {
    console.log(`::warning title=Work Queue sync skipped::Only ${meter.remaining} GraphQL points are left, so the sync stands down until the next run.`);
    return;
  }
  let changes = 0;
  const report = (line) => {
    console.log(`  ${line}`);
    changes += 1;
  };

  if (!board.agentFieldId) {
    console.log(`::warning title=Work Queue Agent column skipped::"${PROJECT_TITLE}" has no "${AGENT_FIELD}" text field.`);
  }
  if (issueNodeId) {
    // The scheduled sweep owns the board's iterations, so an issue event never extends them.
    const issue = findOpenIssue(issueNodeId);
    if (issue) syncIssue(board, issue, { apply, report });
    else console.log('  The issue is closed or outside the tracked repositories; nothing to sync.');
  } else {
    const added = missingIterations(board.iterations, today);
    if (added.length > 0) {
      if (apply) extendIterations(board, added);
      else board.iterations.push(...added);
      report(`${ITERATION_FIELD}: add ${added.map((iteration) => iteration.title).join(', ')}`);
    }
    const issues = REPOSITORIES.flatMap(openIssues);
    if (board.agentFieldId) loadPullRequestComments(issues);
    for (const issue of issues) syncIssue(board, issue, { apply, report });
  }
  console.log(`${apply ? 'Applied' : 'Dry run:'} ${changes} change(s)`);
}

/** The value after `--issue`, or null for a full sweep. */
export function issueArgument(argv) {
  const at = argv.indexOf('--issue');
  if (at === -1) return null;
  const nodeId = argv[at + 1];
  if (!nodeId || nodeId.startsWith('--')) throw new Error('--issue needs the issue node id.');
  return nodeId;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    sync({ apply: process.argv.includes('--apply'), issueNodeId: issueArgument(process.argv) });
  } finally {
    console.log(meter.summary());
  }
}
