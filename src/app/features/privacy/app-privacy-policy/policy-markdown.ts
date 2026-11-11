/**
 * Reads the small part of Markdown the desktop app's privacy policy is written in, into a typed model
 * the page renders with its own template. Nothing here produces HTML, so a policy line can never
 * inject markup, and a link can only be web or mail. A Markdown feature outside that part throws
 * instead of rendering wrong, so the sync script and the spec catch an upstream edit that needs
 * support before it reaches the site. Keep this file free of imports so the sync script, which runs
 * outside Angular, can load it.
 *
 * Supported: one `#` title, `##` sections, `###` subsections, paragraphs, `-` lists, pipe tables,
 * `---` rules (dropped), `**bold**`, `*italic*` and `[text](url)`. Bold, italic and link text do not
 * nest into each other.
 */

export interface InlineSegment {
  readonly text: string;
  readonly strong: boolean;
  readonly emphasis: boolean;
  readonly href: string | null;
}

export type InlineText = readonly InlineSegment[];

export type MarkdownBlock =
  | { readonly kind: 'paragraph'; readonly inline: InlineText }
  | { readonly kind: 'subheading'; readonly id: string; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly InlineText[] }
  | {
      readonly kind: 'table';
      readonly header: readonly InlineText[];
      readonly rows: readonly (readonly InlineText[])[];
    };

export interface MarkdownSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly MarkdownBlock[];
}

export interface PolicyDocument {
  readonly title: string;
  /** The date as the policy words it, and the same day as `YYYY-MM-DD` for a `<time>` element. */
  readonly lastUpdated: { readonly text: string; readonly iso: string };
  /** What comes before the first `##` heading. */
  readonly intro: readonly MarkdownBlock[];
  readonly sections: readonly MarkdownSection[];
}

const MONTHS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const LAST_UPDATED = /^\*\*Last updated: (\d{1,2}) ([A-Za-z]+) (\d{4})\*\*$/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/y;
const SAFE_HREF = /^(https?:\/\/|mailto:)/;
const UNSUPPORTED_LINE_START = /^(>|```|~~~|\d+[.)]\s|<|!\[|[*+]\s|\s{4,}\S)/;

function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fail(message: string, source: string): never {
  throw new Error(`Unsupported Markdown, ${message}: "${source.slice(0, 80)}"`);
}

/** Splits one line of text into styled segments. */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let strong = false;
  let emphasis = false;
  let buffer = '';

  const flush = (): void => {
    if (buffer !== '') {
      segments.push({ text: buffer, strong, emphasis, href: null });
      buffer = '';
    }
  };

  for (let index = 0; index < text.length; ) {
    if (text.startsWith('**', index)) {
      flush();
      strong = !strong;
      index += 2;
    } else if (text[index] === '*') {
      flush();
      emphasis = !emphasis;
      index += 1;
    } else if (text[index] === '[') {
      LINK.lastIndex = index;
      const link = LINK.exec(text);

      if (link === null) {
        buffer += '[';
        index += 1;
        continue;
      }

      const [whole, label, href] = link;

      if (!SAFE_HREF.test(href) || strong || emphasis) {
        fail('a link must be web or mail and stand outside bold and italic', whole);
      }

      flush();
      segments.push({ text: label, strong: false, emphasis: false, href });
      index += whole.length;
    } else {
      buffer += text[index];
      index += 1;
    }
  }

  if (strong || emphasis) {
    fail('bold or italic is not closed on its line', text);
  }

  flush();

  if (segments.some((segment) => segment.strong && segment.emphasis)) {
    fail('bold inside italic', text);
  }

  return segments;
}

function plainText(text: string): string {
  return parseInline(text)
    .map((segment) => segment.text)
    .join('');
}

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)?$/.test(line.trim());
}

function parseDate(day: string, month: string, year: string): PolicyDocument['lastUpdated'] {
  const monthIndex = MONTHS.indexOf(month);

  if (monthIndex === -1) {
    fail('the last updated month is not an English month name', month);
  }

  const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;

  return { text: `${day} ${month} ${year}`, iso };
}

/** Reads the policy. Throws when the text has no title or last updated date, or uses Markdown outside the supported part. */
export function parsePolicyMarkdown(markdown: string): PolicyDocument {
  const lines = markdown.split(/\r?\n/);
  const usedIds = new Set<string>();
  const uniqueId = (text: string): string => {
    const base = slugOf(text);
    let id = base;

    for (let copy = 2; usedIds.has(id); copy += 1) {
      id = `${base}-${copy}`;
    }

    usedIds.add(id);

    return id;
  };

  const found: { title: string | null; lastUpdated: PolicyDocument['lastUpdated'] | null } = {
    title: null,
    lastUpdated: null,
  };
  const intro: MarkdownBlock[] = [];
  const sections: { id: string; heading: string; blocks: MarkdownBlock[] }[] = [];
  let paragraph: string[] = [];
  let items: string[] | null = null;

  const target = (): MarkdownBlock[] => sections.at(-1)?.blocks ?? intro;

  const closeText = (): void => {
    if (paragraph.length > 0) {
      const joined = paragraph.join(' ');
      const updated = LAST_UPDATED.exec(joined);

      if (updated === null) {
        target().push({ kind: 'paragraph', inline: parseInline(joined) });
      } else {
        found.lastUpdated = parseDate(updated[1], updated[2], updated[3]);
      }

      paragraph = [];
    }

    if (items !== null) {
      target().push({ kind: 'list', items: items.map(parseInline) });
      items = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() === '' || /^-{3,}$/.test(line.trim())) {
      closeText();
    } else if (line.startsWith('#')) {
      closeText();
      const heading = /^(#{1,3}) +(\S.*)$/.exec(line);

      if (heading === null) {
        fail('a heading is # to ### followed by a space and text', line);
      }

      const [, marks, text] = heading;
      const plain = plainText(text);

      if (marks.length === 1) {
        found.title ??= plain;
      } else if (marks.length === 2) {
        sections.push({ id: uniqueId(plain), heading: plain, blocks: [] });
      } else {
        target().push({ kind: 'subheading', id: uniqueId(plain), text: plain });
      }
    } else if (line.startsWith('|')) {
      closeText();
      const separator: string | undefined = lines[index + 1];

      if (separator === undefined || !isTableSeparator(separator)) {
        fail('a table needs a header row and a separator row', line);
      }

      const header = cellsOf(line);
      const rows: string[][] = [];

      for (index += 2; index < lines.length && lines[index].startsWith('|'); index += 1) {
        rows.push(cellsOf(lines[index]));
      }

      index -= 1;

      if (rows.some((row) => row.length !== header.length)) {
        fail('a table row has a different number of cells than its header', line);
      }

      target().push({
        kind: 'table',
        header: header.map(parseInline),
        rows: rows.map((row) => row.map(parseInline)),
      });
    } else if (/^- +\S/.test(line)) {
      if (paragraph.length > 0) {
        closeText();
      }

      (items ??= []).push(line.replace(/^- +/, '').trim());
    } else if (items !== null) {
      if (/^\s*-\s/.test(line)) {
        fail('a list inside a list', line);
      }

      items[items.length - 1] += ` ${line.trim()}`;
    } else if (UNSUPPORTED_LINE_START.test(line)) {
      fail('a quote, code block, numbered list, html, image or indented block', line);
    } else {
      paragraph.push(line.trim());
    }
  }

  closeText();

  if (found.title === null) {
    throw new Error('The policy has no # title.');
  }

  if (found.lastUpdated === null) {
    throw new Error('The policy has no "**Last updated: D Month YYYY**" line.');
  }

  return { title: found.title, lastUpdated: found.lastUpdated, intro, sections };
}
