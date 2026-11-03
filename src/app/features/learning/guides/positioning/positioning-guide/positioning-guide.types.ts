export interface GuideNote {
  label: string;
  detail: string;
}

export interface GuideSection {
  title: string;
  summary: string;
  points: string[];
}

export interface DiagramNode {
  text: string;
  /** The node the lesson is about; drawn filled. */
  key?: boolean;
}

export interface DiagramRow {
  label?: string;
  nodes: DiagramNode[];
}

export interface PositioningGuide {
  title: string;
  lede: string;
  sourceLabel: string;
  sourceUrl: string;
  diagram: { caption: string; rows: DiagramRow[] };
  checklist: GuideNote[];
  sections: GuideSection[];
  notesTitle: string;
  notes: GuideNote[];
  drills: GuideNote[];
  /** `label` is the time in the source video ("1:36"), `detail` what is covered there. */
  timestamps: GuideNote[];
}
