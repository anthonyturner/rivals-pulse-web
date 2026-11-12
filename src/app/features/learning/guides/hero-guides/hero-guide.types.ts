export interface HeroGuideSection {
  title: string;
  paragraphs: string[];
}

export interface HeroUltimateGuide {
  name: string;
  plan: string;
  goodAgainst: string[];
  avoidInto: string[];
}

export interface GuideArticleSource {
  label: string;
  url: string;
  note: string;
}

export interface HeroGuideExample {
  title: string;
  paragraphs: string[];
  sourceUrl?: string;
}

export interface HeroGuide {
  heroId: string;
  heroName: string;
  category: 'hero' | 'fundamentals';
  role: 'Vanguard' | 'Duelist' | 'Strategist' | 'Fundamentals';
  image: string;
  sourceLabel: string;
  sourceUrl?: string;
  articleSources?: GuideArticleSource[];
  summary: string;
  poolJob: string;
  pickWhen: string;
  sections: HeroGuideSection[];
  ultimates: HeroUltimateGuide[];
  workedExample?: HeroGuideExample;
  practiceFocus?: string;
}
