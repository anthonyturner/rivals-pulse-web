/** An issue or pull request on GitHub: `owner/repo` and its number. */
export interface GithubTarget {
  repository: string;
  number: number;
}

const GITHUB_LINK = /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/(?:issues|pull)\/(\d+)/g;

function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => stringsIn(item, into));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => stringsIn(item, into));
  }

  return into;
}

function linksIn(strings: readonly string[], repositories: readonly string[]): GithubTarget[] {
  const allowed = new Set(repositories.map((repository) => repository.toLowerCase()));
  const found: GithubTarget[] = [];

  for (const text of strings) {
    for (const match of text.matchAll(GITHUB_LINK)) {
      const repository = `${match[1]}/${match[2]}`;

      if (allowed.has(repository.toLowerCase())) {
        found.push({ repository, number: Number(match[3]) });
      }
    }
  }

  return found;
}

/**
 * The issue or pull request a message posted by the GitHub Slack app is about, or undefined. The app
 * links it in the attachment title (older layout) or the first block (newer layout); a link further down
 * is only a mention inside a comment, so it is used only when the headline has none. Only the listed
 * repositories count.
 */
export function githubTargetOf(message: unknown, repositories: readonly string[]): GithubTarget | undefined {
  const parts = (message ?? {}) as { attachments?: unknown; blocks?: unknown };
  const attachments = Array.isArray(parts.attachments) ? parts.attachments : [];
  const titleLinks = attachments.map((attachment) => (attachment as { title_link?: unknown } | null)?.title_link);
  const blocks = Array.isArray(parts.blocks) ? parts.blocks : [];

  return (
    linksIn(stringsIn(titleLinks), repositories)[0] ??
    linksIn(stringsIn(blocks.slice(0, 1)), repositories)[0] ??
    linksIn(stringsIn(message), repositories)[0]
  );
}
