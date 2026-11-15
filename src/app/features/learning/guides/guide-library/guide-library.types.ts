export type GuideCategory =
  | 'Getting started'
  | 'Hero guides'
  | 'Fundamentals'
  | 'Positioning'
  | 'Team play and mechanics'
  | 'Strategist lessons';

export interface LibraryGuide {
  readonly title: string;
  readonly path: string;
  readonly category: GuideCategory;
  readonly hero: string | null;
  readonly imageUrl: string;
  readonly caption: string;
  readonly blurb: string;
  readonly searchText: string;
}

export interface GuideSection {
  readonly category: GuideCategory;
  readonly guides: readonly LibraryGuide[];
}
