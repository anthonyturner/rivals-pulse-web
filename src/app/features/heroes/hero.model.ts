export type HeroRole = 'Vanguard' | 'Duelist' | 'Strategist' | 'Multi-Role';

export interface HeroGameplayArchetype {
  role: HeroRole;
  label: string;
  description: string;
  sourceTitle: string;
  sourceUrl: string;
  timestamp: string;
}

export interface HeroSeasonWinRateInsight {
  heroId: string;
  displayName: string;
  role: Exclude<HeroRole, 'Multi-Role'>;
  archetype: string;
  lowRanks: string;
  grandmaster: string;
  celestial: string;
  trend: 'Climbing' | 'Stable' | 'Falling' | 'Volatile';
  takeaway: string;
  imageUrl: string;
  videoUrl: string;
  timestamp: string;
}

export interface HeroAbilityTechnicalDetail {
  label: string;
  value: string;
}

export interface HeroAbility {
  name: string;
  type: string;
  description: string;
  technicalDetails?: HeroAbilityTechnicalDetail[];
}

export interface HeroOfficialSource {
  id?: string;
  sourceUrl: string;
  subtitle?: string;
  fetchedFrom?: string;
  baseStats?: HeroAbilityTechnicalDetail[];
  baseStatKits?: {
    role?: HeroRole;
    label: string;
    stats: HeroAbilityTechnicalDetail[];
  }[];
}

export interface HeroRoleAbilityKit {
  role: HeroRole;
  label: string;
  abilities: HeroAbility[];
}

export interface HeroBuildProfile {
  Utility: number;
  Damage: number;
  Sustain: number;
  Mobility: number;
  Ultimate: number;
}

export interface HeroBuildProfileRationale {
  source: {
    label: string;
    url: string;
  };
  reason: string;
  strongestSignals: string[];
}

export interface HeroPlaystyleGuide {
  id: string;
  role?: HeroRole;
  title: string;
  sourceTitle?: string;
  sourceUrl?: string;
  summary: string;
  whenToUse: string;
  coreIdeas: {
    label: string;
    description: string;
  }[];
  upgradeNotes: string[];
  ultimateNotes: string[];
}

export interface HeroStrategySituation {
  label: string;
  description: string;
}

export interface HeroStrategyGuide {
  sourceTitle: string;
  sourceUrl: string;
  summary: string;
  paragraphs: string[];
  situations: HeroStrategySituation[];
}

export type HeroVideoType = 'paz-gameplay' | 'paz-counters-combos';

export interface HeroVideo {
  heroId: string | null;
  role?: HeroRole;
  videoType: HeroVideoType;
  youtubeId: string;
  title: string;
}

export interface Hero {
  id: string;
  name: string;
  role: HeroRole;
  difficulty: number;
  summary: string;
  overview?: string;
  strategyGuide?: HeroStrategyGuide;
  playstyle: string;
  strengths: string[];
  weaknesses: string[];
  counters: string[];
  synergies: string[];
  abilities: HeroAbility[];
  roleAbilityKits?: HeroRoleAbilityKit[];
  playstyles?: HeroPlaystyleGuide[];
  buildProfile?: HeroBuildProfile;
  buildProfileRationale?: HeroBuildProfileRationale;
  gameplayArchetypes?: HeroGameplayArchetype[];
  season9WinRateInsights?: HeroSeasonWinRateInsight[];
  officialSource?: HeroOfficialSource;
  imageUrl: string;
}
