export interface SeasonUpdate {
  category: string;
  date: string;
  title: string;
  description: string;
  sourceUrl: string;
  videoUrl?: string;
  videoPosterUrl?: string;
  videoTitle?: string;
}

export interface SeasonHighlight {
  label: string;
  title: string;
  description: string;
}
