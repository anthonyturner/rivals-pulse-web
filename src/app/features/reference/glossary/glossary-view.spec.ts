import { GlossaryTerm } from './glossary.model';
import {
  ALL_CATEGORIES,
  buildRows,
  categoryLabel,
  filterRows,
  groupByLetter,
  letterId,
  resultsStatus,
  searchKey,
} from './glossary-view';

const term = (id: string, name: string, overrides: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  id,
  term: name,
  category: 'Combat',
  definition: `${name} means something.`,
  coachNote: 'A note.',
  example: 'An example.',
  relatedTerms: [],
  sourceName: 'Wiki',
  sourceUrl: 'https://example.test/wiki',
  ...overrides,
});

describe('glossary view', () => {
  describe('searchKey', () => {
    it('ignores case and surrounding spaces', () => {
      expect(searchKey('  DiVe ')).toBe('dive');
    });

    it('turns hyphens into spaces and drops apostrophes, straight or curly', () => {
      expect(searchKey('Team-Up')).toBe('team up');
      expect(searchKey("Don't")).toBe('dont');
      expect(searchKey('Don’t')).toBe('dont');
    });
  });

  describe('categoryLabel', () => {
    it('leaves a name that is already written for people', () => {
      expect(categoryLabel('Gaming Chat')).toBe('Gaming Chat');
      expect(categoryLabel('Team-Up')).toBe('Team-Up');
    });

    it('turns a slug into a name, keeping the brand words capitalised', () => {
      expect(categoryLabel('gaming-chat')).toBe('Gaming chat');
      expect(categoryLabel('heard-in-game')).toBe('Heard in game');
      expect(categoryLabel('marvel-rivals')).toBe('Marvel Rivals');
    });
  });

  describe('resultsStatus', () => {
    it('counts the terms when nothing is filtered, in the singular and the plural', () => {
      expect(resultsStatus(133, null, '')).toBe('133 terms');
      expect(resultsStatus(1, null, '')).toBe('1 term');
    });

    it('names the category', () => {
      expect(resultsStatus(27, 'Gaming chat', '')).toBe('27 terms in Gaming chat');
      expect(resultsStatus(1, 'Gaming chat', '')).toBe('1 term in Gaming chat');
    });

    it('quotes the search, with "match" agreeing with the count', () => {
      expect(resultsStatus(12, null, 'dive')).toBe('12 terms match “dive”');
      expect(resultsStatus(1, null, 'dive')).toBe('1 term matches “dive”');
    });

    it('says both when both are set', () => {
      expect(resultsStatus(3, 'Gaming chat', 'dive')).toBe('3 terms in Gaming chat match “dive”');
      expect(resultsStatus(1, 'Gaming chat', 'gg')).toBe('1 term in Gaming chat matches “gg”');
    });

    it('says plainly that nothing matches', () => {
      expect(resultsStatus(0, null, 'xyzzy')).toBe('No terms match “xyzzy”');
      expect(resultsStatus(0, 'Gaming chat', 'xyzzy')).toBe('No terms in Gaming chat match “xyzzy”');
    });
  });

  describe('buildRows', () => {
    const rows = buildRows([
      term('team-up', 'Team-Up', { relatedTerms: ['Anchor Hero', 'Team-Up', 'Not a term'] }),
      term('anchor-hero', 'Anchor Hero'),
      term('hash', '#wood players'),
    ]);

    it('sorts by term, case and accents aside', () => {
      expect(rows.map((row) => row.id)).toEqual(['hash', 'anchor-hero', 'team-up']);
    });

    it('links a related term only when the glossary has it, and never to itself', () => {
      const related = rows.find((row) => row.id === 'team-up')?.related;

      expect(related).toEqual([
        { name: 'Anchor Hero', id: 'anchor-hero' },
        { name: 'Team-Up', id: null },
        { name: 'Not a term', id: null },
      ]);
    });

    it('puts a term that does not start with a letter under "#"', () => {
      expect(rows.map((row) => row.letter)).toEqual(['#', 'A', 'T']);
    });
  });

  describe('filterRows', () => {
    const rows = buildRows([
      term('dive', 'Dive', { category: 'Combat', definition: 'Jump on a target.', relatedTerms: ['Flank'] }),
      term('gg', 'gg', { category: 'Gaming Chat', definition: 'Good game, said after a dive.' }),
      term('team-up', 'Team-Up', { category: 'Combat' }),
    ]);
    const ids = (category: string, query: string): string[] => filterRows(rows, category, searchKey(query)).map((row) => row.id);

    it('matches the term, the definition and the related terms', () => {
      expect(ids(ALL_CATEGORIES, 'dive')).toEqual(['dive', 'gg']);
      expect(ids(ALL_CATEGORIES, 'flank')).toEqual(['dive']);
    });

    it('finds Team-Up from "team up"', () => {
      expect(ids(ALL_CATEGORIES, 'team up')).toEqual(['team-up']);
    });

    it('combines the category with the search', () => {
      expect(ids('Gaming Chat', 'dive')).toEqual(['gg']);
      expect(ids('Combat', '')).toEqual(['dive', 'team-up']);
    });
  });

  describe('groupByLetter', () => {
    const groups = groupByLetter(buildRows([term('b', 'Bravo'), term('hash', '#wood'), term('a2', 'Alpha two'), term('a1', 'Alpha')]));

    it('groups A to Z with "#" last, each with its own id and jump label', () => {
      expect(groups.map((group) => [group.id, group.label])).toEqual([
        ['letter-a', 'A'],
        ['letter-b', 'B'],
        ['letter-other', '#'],
      ]);
      expect(groups[0].jumpLabel).toBe('Terms starting with A');
      expect(groups[2].jumpLabel).toBe('Terms starting with a symbol or number');
    });

    it('keeps the rows of a group in order', () => {
      expect(groups[0].rows.map((row) => row.id)).toEqual(['a1', 'a2']);
    });

    it('names a letter heading by letterId', () => {
      expect(letterId('Q')).toBe('letter-q');
      expect(letterId('#')).toBe('letter-other');
    });
  });
});
