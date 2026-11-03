import { countLabel } from '../../../shared/utilities/stat-labels';
import { GlossaryTerm } from './glossary.model';

/** The Category filter's value for "no category chosen". */
export const ALL_CATEGORIES = 'all';

export interface RelatedTerm {
  name: string;
  /** The id of the glossary term with this name, or null when the glossary has none. */
  id: string | null;
}

/** A glossary term as the page shows it, with everything the template reads worked out once. */
export interface TermRow {
  id: string;
  buttonId: string;
  panelId: string;
  term: string;
  definition: string;
  coachNote: string;
  example: string;
  /** The raw category, which is what the Category filter matches. */
  category: string;
  categoryLabel: string;
  sourceName: string;
  sourceUrl: string;
  related: readonly RelatedTerm[];
  /** The searchable text of the term, its definition and its related terms, as `searchKey` writes it. */
  keys: readonly string[];
  letter: string;
}

export interface LetterGroup {
  /** The heading's id, which is also the fragment that jumps to it. */
  id: string;
  label: string;
  jumpLabel: string;
  rows: readonly TermRow[];
}

/** Lower-cases, turns hyphens into spaces and drops apostrophes, so "team up" finds "Team-Up" and "dont" finds "Don't". */
export function searchKey(text: string): string {
  return text.toLowerCase().replace(/['‘’]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Brand words a derived category name keeps capitalised. */
const BRAND_WORDS = new Set(['marvel', 'rivals']);

/** A category's name for people. The database holds names such as "Gaming Chat" already; only a slug such as `gaming-chat` is turned into one. */
export function categoryLabel(category: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(category)) {
    return category;
  }

  const words = category.split('-').map((word) => (BRAND_WORDS.has(word) ? word[0].toUpperCase() + word.slice(1) : word));
  const text = words.join(' ');

  return text[0].toUpperCase() + text.slice(1);
}

/**
 * The sentence that says how many terms are listed, for every mix of filters:
 * `133 terms`, `1 term in Gaming chat`, `12 terms match “dive”`, `No terms in Gaming chat match “xyzzy”`.
 */
export function resultsStatus(count: number, category: string | null, query: string): string {
  const inCategory = category === null ? '' : ` in ${category}`;

  if (query === '') {
    return `${countLabel(count, 'term', 'terms')}${inCategory}`;
  }
  if (count === 0) {
    return `No terms${inCategory} match “${query}”`;
  }

  return `${countLabel(count, 'term', 'terms')}${inCategory} ${count === 1 ? 'matches' : 'match'} “${query}”`;
}

/** The rows with the whole key as a substring of one of their keys. An empty key keeps everything. */
export function filterRows(rows: readonly TermRow[], category: string, key: string): TermRow[] {
  return rows.filter(
    (row) => (category === ALL_CATEGORIES || row.category === category) && (key === '' || row.keys.some((text) => text.includes(key))),
  );
}

export function buildRows(terms: readonly GlossaryTerm[]): TermRow[] {
  const idByName = new Map(terms.map((term) => [searchKey(term.term), term.id]));

  return terms
    .map((term): TermRow => {
      const related = term.relatedTerms.map((name) => {
        const id = idByName.get(searchKey(name)) ?? null;

        return { name, id: id === term.id ? null : id };
      });

      return {
        id: term.id,
        buttonId: `term-${term.id}`,
        panelId: `details-${term.id}`,
        term: term.term,
        definition: term.definition,
        coachNote: term.coachNote,
        example: term.example,
        category: term.category,
        categoryLabel: categoryLabel(term.category),
        sourceName: term.sourceName,
        sourceUrl: term.sourceUrl,
        related,
        keys: [term.term, term.definition, ...term.relatedTerms].map(searchKey),
        letter: /^[a-z]/i.test(term.term) ? term.term[0].toUpperCase() : '#',
      };
    })
    .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
}

/** The id of a letter's heading. Terms that do not start with a letter share the "#" group. */
export function letterId(letter: string): string {
  return letter === '#' ? 'letter-other' : `letter-${letter.toLowerCase()}`;
}

/** Rows grouped by first letter, A to Z, with the "#" group last. */
export function groupByLetter(rows: readonly TermRow[]): LetterGroup[] {
  const byLetter = new Map<string, TermRow[]>();

  for (const row of rows) {
    const group = byLetter.get(row.letter);

    if (group) {
      group.push(row);
    } else {
      byLetter.set(row.letter, [row]);
    }
  }

  return [...byLetter.entries()]
    .sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
    .map(([letter, groupRows]) => ({
      id: letterId(letter),
      label: letter,
      jumpLabel: letter === '#' ? 'Terms starting with a symbol or number' : `Terms starting with ${letter}`,
      rows: groupRows,
    }));
}
