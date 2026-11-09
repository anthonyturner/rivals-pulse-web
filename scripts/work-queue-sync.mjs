// Keeps the "Rivals Pulse Work Queue" board (GitHub user Project 2) in step with
// the open issues of both Rivals Pulse repositories. The board is a computed view
// (overlay ADR-0024): every card's Status and Iteration is derived here, and nobody
// sets either by hand.
//
// Usage: node scripts/work-queue-sync.mjs [--apply]
// Dry run by default. Needs `gh` and a GH_TOKEN with `repo` and `project` scopes.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PROJECT_OWNER = 'anthonyturner';
const PROJECT_NUMBER = 2;
const PROJECT_TITLE = 'Rivals Pulse Work Queue';
const STATUS_FIELD = 'Status';
const ITERATION_FIELD = 'Iteration';
const ITERATION_DAYS = 7;
const DAY_MS = 86_400_000;
const REPOSITORIES = ['anthonyturner/rivals_pulse', 'anthonyturner/rivals-pulse-web'];

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

function graphql(query, variables = {}) {
  const body = JSON.stringify({ query, variables });
  const response = JSON.parse(
    execFileSync('gh', ['api', 'graphql', '--input', '-'], { input: body, encoding: 'utf8', maxBuffer: 64e6 }),
  );
  if (response.errors) throw new Error(response.errors.map((error) => error.message).join('; '));
  return response.data;
}

function findBoard() {
  const { user } = graphql(
    `query($owner: String!, $number: Int!, $status: String!, $iteration: String!) {
      user(login: $owner) { projectV2(number: $number) {
        id title
        status: field(name: $status) { ... on ProjectV2SingleSelectField { id options { id name } } }
        iteration: field(name: $iteration) { ... on ProjectV2IterationField { id configuration {
          iterations { id title startDate duration }
          completedIterations { id title startDate duration }
        } } }
      } }
    }`,
    { owner: PROJECT_OWNER, number: PROJECT_NUMBER, status: STATUS_FIELD, iteration: ITERATION_FIELD },
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

/**
 * Appends iterations to the field. Every existing iteration is sent back with its id,
 * which keeps its id and the items already in it; without the ids GitHub would
 * recreate every iteration and clear all item values.
 */
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

function openIssues(repository) {
  const [owner, name] = repository.split('/');
  const issues = [];
  let after = null;
  do {
    const { repository: repo } = graphql(
      `query($owner: String!, $name: String!, $after: String) {
        repository(owner: $owner, name: $name) { issues(states: OPEN, first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id number
            labels(first: 50) { nodes { name } }
            closedByPullRequestsReferences(first: 10, includeClosedPrs: true) { nodes { state isDraft createdAt } }
            projectItems(first: 20) { nodes {
              id project { id }
              status: fieldValueByName(name: "${STATUS_FIELD}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              iteration: fieldValueByName(name: "${ITERATION_FIELD}") { ... on ProjectV2ItemFieldIterationValue { title } }
            } }
          }
        } }
      }`,
      { owner, name, ...(after ? { after } : {}) },
    );
    issues.push(...repo.issues.nodes);
    after = repo.issues.pageInfo.hasNextPage ? repo.issues.pageInfo.endCursor : null;
  } while (after);
  return issues;
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

function sync({ apply, today = new Date().toISOString().slice(0, 10) }) {
  const board = findBoard();
  let changes = 0;
  const report = (line) => {
    console.log(`  ${line}`);
    changes += 1;
  };

  const added = missingIterations(board.iterations, today);
  if (added.length > 0) {
    if (apply) extendIterations(board, added);
    else board.iterations.push(...added);
    report(`${ITERATION_FIELD}: add ${added.map((iteration) => iteration.title).join(', ')}`);
  }

  for (const repository of REPOSITORIES) {
    for (const issue of openIssues(repository)) {
      const label = `${repository}#${issue.number}`;
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
      if (item?.iteration) continue;
      const startedOn = workStartedOn(issue);
      const iteration = startedOn && iterationOn(startedOn, board.iterations);
      if (!iteration) continue;
      if (apply) setField(board, ensureItem(), board.iterationFieldId, { iterationId: iteration.id });
      report(`${label}: ${ITERATION_FIELD} -> ${iteration.title}`);
    }
  }
  console.log(`${apply ? 'Applied' : 'Dry run:'} ${changes} change(s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sync({ apply: process.argv.includes('--apply') });
}
