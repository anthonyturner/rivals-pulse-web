import { parseInline, parsePolicyMarkdown } from './policy-markdown';

const wrap = (body: string): string => `# Title\n\n**Last updated: 3 March 2027**\n\n${body}\n`;

describe('parseInline', () => {
  it('splits bold, italic, plain text and links into segments', () => {
    expect(parseInline('a **b** *c* [d](https://example.com/x)')).toEqual([
      { text: 'a ', strong: false, emphasis: false, href: null },
      { text: 'b', strong: true, emphasis: false, href: null },
      { text: ' ', strong: false, emphasis: false, href: null },
      { text: 'c', strong: false, emphasis: true, href: null },
      { text: ' ', strong: false, emphasis: false, href: null },
      { text: 'd', strong: false, emphasis: false, href: 'https://example.com/x' },
    ]);
  });

  it('keeps square brackets that are not a link as text', () => {
    expect(parseInline('**[TO BE CONFIRMED]** later')).toEqual([
      { text: '[TO BE CONFIRMED]', strong: true, emphasis: false, href: null },
      { text: ' later', strong: false, emphasis: false, href: null },
    ]);
  });

  it('keeps markup-looking text as text, since the page never writes HTML', () => {
    expect(parseInline('a <script>x</script> & b')[0].text).toBe('a <script>x</script> & b');
  });

  it('accepts web and mail links only', () => {
    expect(parseInline('[mail](mailto:a@example.com)')[0].href).toBe('mailto:a@example.com');
    expect(() => parseInline('[x](javascript:alert)')).toThrowError(/web or mail/);
    expect(() => parseInline('[x](/relative)')).toThrowError(/web or mail/);
  });

  it('rejects styling it cannot render', () => {
    expect(() => parseInline('**open')).toThrowError(/not closed/);
    expect(() => parseInline('***both***')).toThrowError(/bold inside italic/);
    expect(() => parseInline('**[x](https://example.com)**')).toThrowError(/web or mail/);
  });
});

describe('parsePolicyMarkdown', () => {
  it('reads the title and the last updated date, and keeps the date out of the body', () => {
    const policy = parsePolicyMarkdown(wrap('Intro.'));

    expect(policy.title).toBe('Title');
    expect(policy.lastUpdated).toEqual({ text: '3 March 2027', iso: '2027-03-03' });
    expect(policy.intro.length).toBe(1);
  });

  it('pads a single digit day and month in the machine-readable date', () => {
    expect(parsePolicyMarkdown('# T\n\n**Last updated: 9 January 2027**\n').lastUpdated.iso).toBe('2027-01-09');
  });

  it('fails without a title or a last updated date, so a bad copy is never published', () => {
    expect(() => parsePolicyMarkdown('**Last updated: 3 March 2027**\n\ntext')).toThrowError(/no # title/);
    expect(() => parsePolicyMarkdown('# Title\n\ntext')).toThrowError(/Last updated/);
    expect(() => parsePolicyMarkdown('# T\n\n**Last updated: 3 Marchh 2027**\n')).toThrowError(/month/);
  });

  it('groups blocks under their ## heading, with ### headings inside, and drops rules', () => {
    const policy = parsePolicyMarkdown(
      wrap('Intro.\n\n---\n\n## 1. First\n\nOne.\n\n### 1.1 Inner\n\nTwo.\n\n---\n\n## 2. Second\n\nThree.'),
    );

    expect(policy.sections.map((section) => [section.id, section.heading])).toEqual([
      ['section-1-first', '1. First'],
      ['section-2-second', '2. Second'],
    ]);
    expect(policy.sections[0].blocks.map((block) => block.kind)).toEqual(['paragraph', 'subheading', 'paragraph']);
    expect(policy.sections[0].blocks[1]).toEqual({ kind: 'subheading', id: 'section-1-1-inner', text: '1.1 Inner' });
  });

  it('gives repeated headings different ids so fragment links stay unique', () => {
    const policy = parsePolicyMarkdown(wrap('## Same\n\nA.\n\n## Same\n\nB.'));

    expect(policy.sections.map((section) => section.id)).toEqual(['section-same', 'section-same-2']);
  });

  it('joins wrapped paragraph and list lines, and starts a new list item at each dash', () => {
    const policy = parsePolicyMarkdown(wrap('## S\n\nwrapped\nline\n\n- one\n  continued\n- two **bold**'));
    const [paragraph, list] = policy.sections[0].blocks;

    expect(paragraph.kind === 'paragraph' && paragraph.inline.map((segment) => segment.text).join('')).toBe(
      'wrapped line',
    );
    expect(list.kind === 'list' && list.items.length).toBe(2);
    expect(list.kind === 'list' && list.items[0].map((segment) => segment.text).join('')).toBe('one continued');
  });

  it('reads a pipe table into a header and rows', () => {
    const policy = parsePolicyMarkdown(wrap('## S\n\n| A | B |\n| --- | --- |\n| 1 | **2** |\n| 3 | 4 |'));
    const table = policy.sections[0].blocks[0];

    expect(table.kind).toBe('table');
    expect(table.kind === 'table' && table.header.length).toBe(2);
    expect(table.kind === 'table' && table.rows.length).toBe(2);
    expect(table.kind === 'table' && table.rows[0][1][0].strong).toBeTrue();
  });

  it('rejects a table row with the wrong number of cells', () => {
    expect(() => parsePolicyMarkdown(wrap('## S\n\n| A | B |\n| --- | --- |\n| 1 |'))).toThrowError(
      /number of cells/,
    );
  });

  const unsupported: readonly (readonly [string, string])[] = [
    ['a quote', '> quoted'],
    ['a code fence', '```\ncode\n```'],
    ['a numbered list', '1. first'],
    ['html', '<div>x</div>'],
    ['an image', '![alt](https://example.com/a.png)'],
    ['a nested list', '- a\n  - b'],
    ['a heading with no space', '##Nope'],
  ];

  for (const [name, body] of unsupported) {
    it(`rejects ${name} instead of rendering it wrong`, () => {
      expect(() => parsePolicyMarkdown(wrap(body))).toThrowError(/Unsupported Markdown/);
    });
  }
});
