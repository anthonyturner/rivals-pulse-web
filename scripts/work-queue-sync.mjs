// Keeps the "Rivals Pulse Work Queue" board (GitHub user Project 2) in step with
// the open issues of both Rivals Pulse repositories. The board is a computed view
// (overlay ADR-0024): every card's Status is derived here, and nobody sets it by hand.
//
// Usage: node scripts/work-queue-sync.mjs [--apply]
// Dry run by default. Needs `gh` and a GH_TOKEN with `repo` and `project` scopes.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PROJECT_OWNER = 'anthonyturner';
const PROJECT_NUMBER = 2;
const PROJECT_TITLE = 'Rivals Pulse Work Queue';
const STATUS_FIELD = 'Status';
const REPOSITORIES = ['anthonyturner/rivals_pulse', 'anthonyturner/rivals-pulse-web'];

/** Every status this script can assign. Closed issues are moved to Done by the project's own "Item closed" workflow. */
export const STATUSES = ['Needs Tony', 'In review', 'Agent working', 'Ready', 'Backlog'];

/** The board status an open issue should have. The first rule that matches wins. */
export function desiredStatus(issue) {
  const labels = issue.labels.nodes.map((label) => label.name);
  const openPullRequests = issue.closedByPullRequestsReferences.nodes.filter(
    (pullRequest) => pullRequest.state === 'OPEN',
  );
  if (labels.includes('needs-tony')) return 'Needs Tony';
  if (openPullRequests.some((pullRequest) => !pullRequest.isDraft)) return 'In review';
  if (openPullRequests.length > 0) return 'Agent working';
  if (labels.includes('ready')) return 'Ready';
  return 'Backlog';
}

function graphql(query, variables = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    args.push(typeof value === 'number' ? '-F' : '-f', `${name}=${value}`);
  }
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64e6 })).data;
}

function findBoard() {
  const { user } = graphql(
    `query($owner: String!, $number: Int!, $field: String!) {
      user(login: $owner) { projectV2(number: $number) {
        id title
        field(name: $field) { ... on ProjectV2SingleSelectField { id options { id name } } }
      } }
    }`,
    { owner: PROJECT_OWNER, number: PROJECT_NUMBER, field: STATUS_FIELD },
  );
  const project = user?.projectV2;
  if (project?.title !== PROJECT_TITLE) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} is not "${PROJECT_TITLE}".`);
  }
  if (!project.field?.id) throw new Error(`"${PROJECT_TITLE}" has no single-select "${STATUS_FIELD}" field.`);
  const optionIds = Object.fromEntries(project.field.options.map((option) => [option.name, option.id]));
  const missing = STATUSES.filter((status) => !optionIds[status]);
  if (missing.length > 0) throw new Error(`"${STATUS_FIELD}" is missing options: ${missing.join(', ')}.`);
  return { projectId: project.id, fieldId: project.field.id, optionIds };
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
            closedByPullRequestsReferences(first: 10) { nodes { state isDraft } }
            projectItems(first: 20) { nodes {
              id project { id }
              fieldValueByName(name: "${STATUS_FIELD}") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
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

function setStatus(board, itemId, status) {
  graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
      }) { clientMutationId }
    }`,
    { project: board.projectId, item: itemId, field: board.fieldId, option: board.optionIds[status] },
  );
}

function sync({ apply }) {
  const board = findBoard();
  const changes = [];
  for (const repository of REPOSITORIES) {
    for (const issue of openIssues(repository)) {
      const item = issue.projectItems.nodes.find((node) => node.project.id === board.projectId);
      const current = item?.fieldValueByName?.name ?? null;
      const wanted = desiredStatus(issue);
      if (current === wanted) continue;
      changes.push(`${repository}#${issue.number}: ${current ?? '(not on board)'} -> ${wanted}`);
      if (apply) setStatus(board, item?.id ?? addToBoard(board, issue), wanted);
    }
  }
  console.log(`${apply ? 'Applied' : 'Dry run:'} ${changes.length} change(s)`);
  for (const change of changes) console.log(`  ${change}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  sync({ apply: process.argv.includes('--apply') });
}
