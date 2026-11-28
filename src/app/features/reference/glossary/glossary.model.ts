export interface GlossaryTerm {
  id: string;
  term: string;
  category: string;
  definition: string;
  coachNote: string;
  example: string;
  relatedTerms: string[];
  sourceName: string;
  sourceUrl: string;
}
