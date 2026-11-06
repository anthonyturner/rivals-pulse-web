import type { GlossaryTerm } from '../../reference/glossary/glossary.model';

const DAY_IN_MILLISECONDS = 86_400_000;

export function selectWordOfDay(
  terms: readonly GlossaryTerm[],
  date: Date,
): GlossaryTerm | null {
  const eligibleTerms = terms
    .filter((term) => term.category === 'marvel-rivals')
    .sort((left, right) => {
      const leftName = left.term.trim().toLowerCase();
      const rightName = right.term.trim().toLowerCase();

      if (leftName !== rightName) {
        return leftName < rightName ? -1 : 1;
      }

      return left.id < right.id ? -1 : left.id === right.id ? 0 : 1;
    });

  if (eligibleTerms.length === 0) {
    return null;
  }

  const localDay = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MILLISECONDS,
  );
  const index = ((localDay % eligibleTerms.length) + eligibleTerms.length) % eligibleTerms.length;

  return eligibleTerms[index] ?? null;
}
