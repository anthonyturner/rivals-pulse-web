import { Injectable } from '@angular/core';

import {
  BuildSignalRow,
  HeroBuildType,
  HeroScoresAnswer,
  teamBuildSignals,
} from '../../heroes/hero-build-signals/hero-build-signals';
import { Hero, HeroRole } from '../../heroes/hero.model';

type CompArchetype = 'Dive/Pick' | 'Poke' | 'Brawl' | 'Balanced';
type CoreHeroRole = Exclude<HeroRole, 'Multi-Role'>;

export interface BuildSignal {
  type: HeroBuildType;
  summary: string;
}

export interface CompSummary {
  title: string;
  grade: string;
  description: string;
  roleLine: string;
  strengths: string[];
  risks: string[];
  signals: BuildSignalRow[];
  /** The signal the team leans on, or null while too little of it has data to say. */
  lean: HeroBuildType | null;
}

const archetypeHeroIds: Record<Exclude<CompArchetype, 'Balanced'>, string[]> = {
  'Dive/Pick': [
    'black-panther',
    'magik',
    'spider-man',
    'psylocke',
    'iron-fist',
    'daredevil',
    'black-cat',
    'venom',
    'captain-america',
    'thor',
    'wolverine',
  ],
  Poke: [
    'black-widow',
    'hawkeye',
    'hela',
    'cyclops',
    'phoenix',
    'iron-man',
    'storm',
    'namor',
    'the-punisher',
  ],
  Brawl: [
    'groot',
    'the-thing',
    'hulk',
    'magneto',
    'emma-frost',
    'scarlet-witch',
    'squirrel-girl',
    'cloak-and-dagger',
  ],
};

@Injectable({ providedIn: 'root' })
export class TeamCompositionEngineService {
  readonly buildSignals: BuildSignal[] = [
    {
      type: 'Utility',
      summary:
        'changes enemy choices with saves, control, denial, scouting, shields, and fight-shaping cooldowns',
    },
    {
      type: 'Damage',
      summary: 'wins through pressure, burst windows, target focus, and finishing power',
    },
    {
      type: 'Sustain',
      summary:
        'survives longer with healing, shields, damage reduction, revives, and defensive resources',
    },
    {
      type: 'Mobility',
      summary:
        'uses movement, rotations, vertical access, chase routes, and escapes to choose the fight location',
    },
    {
      type: 'Ultimate',
      summary: 'protects and converts a major ultimate or combo into the fight-winning moment',
    },
  ];

  analyzeTeam(selectedHeroes: Hero[], scores: HeroScoresAnswer, teamSize: number): CompSummary {
    const roleCounts = this.roleCounts(selectedHeroes);
    const signals = teamBuildSignals(selectedHeroes, scores, teamSize);
    const lean = this.leaningSignal(signals, selectedHeroes.length);
    const archetype = this.compArchetype(selectedHeroes, roleCounts);
    const filledSlots = selectedHeroes.length;
    const roleLine = `${roleCounts['Vanguard']} Vanguard / ${roleCounts['Duelist']} Duelist / ${roleCounts['Strategist']} Strategist`;

    if (filledSlots === 0) {
      return {
        title: 'Start building a six-player comp',
        grade: 'Empty',
        description:
          'Drag heroes into the six slots to analyze role balance and whether the team leans utility, damage, sustain, mobility, or ultimate focused.',
        roleLine,
        strengths: ['Use the hero thumbnails below as your draft pool.'],
        risks: ['The comp summary will activate after you add heroes.'],
        signals,
        lean,
      };
    }

    const quality = this.compQuality(filledSlots, roleCounts);
    const signal = this.buildSignals.find((item) => item.type === lean);
    const leaning = lean ? `${lean.toLowerCase()}-leaning ` : '';

    return {
      title: lean ? `${lean} ${archetype} Comp` : `${archetype} Comp`,
      grade: quality.grade,
      description:
        filledSlots < 6
          ? `You have ${filledSlots}/6 heroes selected. So far this looks like a ${leaning}${archetype.toLowerCase()} draft${signal ? ` that ${signal.summary}` : ''}.`
          : this.compDescription(leaning, archetype, signal?.summary),
      roleLine,
      strengths: this.compStrengths(lean, archetype, roleCounts, filledSlots),
      risks: this.compRisks(lean, archetype, roleCounts, filledSlots),
      signals,
      lean,
    };
  }

  private roleCounts(heroes: Hero[]): Record<CoreHeroRole, number> {
    return heroes.reduce(
      (counts, hero) => {
        const role = hero.role === 'Multi-Role' ? 'Duelist' : hero.role;
        counts[role] += 1;

        return counts;
      },
      { Vanguard: 0, Duelist: 0, Strategist: 0 },
    );
  }

  /**
   * The highest signal among those with a number for most of the chosen heroes. It takes two such
   * signals to compare, so Mobility alone, which needs no match data, never names a team's lean.
   */
  private leaningSignal(signals: readonly BuildSignalRow[], chosen: number): HeroBuildType | null {
    const comparable = signals.filter(({ used, value }) => value !== null && used * 2 > chosen);

    return comparable.length < 2
      ? null
      : comparable.reduce((best, row) => ((row.value ?? 0) > (best.value ?? 0) ? row : best)).type;
  }

  private compArchetype(
    heroes: Hero[],
    roleCounts: Record<CoreHeroRole, number>,
  ): CompArchetype {
    const diveCount = this.archetypeCount(heroes, 'Dive/Pick');
    const pokeCount = this.archetypeCount(heroes, 'Poke');
    const brawlCount = this.archetypeCount(heroes, 'Brawl');

    if (diveCount >= 2) {
      return 'Dive/Pick';
    }

    if (pokeCount >= 2 && diveCount === 0) {
      return 'Poke';
    }

    if (brawlCount >= 2 || roleCounts.Vanguard >= 2) {
      return 'Brawl';
    }

    return 'Balanced';
  }

  private archetypeCount(heroes: Hero[], archetype: Exclude<CompArchetype, 'Balanced'>): number {
    const heroIds = new Set(archetypeHeroIds[archetype]);

    return heroes.filter((hero) => heroIds.has(hero.id)).length;
  }

  private compDescription(
    leaning: string,
    archetype: CompArchetype,
    buildSummary = 'has a defined fight plan',
  ): string {
    if (archetype === 'Dive/Pick') {
      return 'This six-player team reads more like a dive/pick comp than a raw damage comp. Based on the build theory page, it wants to stage first, collapse on a vulnerable target, force defensive cooldowns, then reset before the counter-engage.';
    }

    return `This six-player team looks like a ${leaning}${archetype.toLowerCase()} comp. Based on the build theory page, it ${buildSummary}.`;
  }

  private compQuality(
    filledSlots: number,
    roleCounts: Record<CoreHeroRole, number>,
  ): { grade: string; score: number } {
    let score = 0;

    score += filledSlots * 8;
    score += roleCounts.Vanguard >= 1 ? 14 : -12;
    score += roleCounts.Strategist >= 2 ? 18 : roleCounts.Strategist === 1 ? 6 : -16;
    score += roleCounts.Duelist >= 2 ? 10 : 0;
    score += roleCounts.Duelist > 3 ? -8 : 0;

    if (filledSlots < 6) {
      score -= (6 - filledSlots) * 7;
    }

    if (score >= 82) {
      return { grade: 'Excellent', score };
    }

    if (score >= 66) {
      return { grade: 'Strong', score };
    }

    if (score >= 48) {
      return { grade: 'Playable', score };
    }

    return { grade: 'Needs work', score };
  }

  private compStrengths(
    lean: HeroBuildType | null,
    archetype: CompArchetype,
    roleCounts: Record<CoreHeroRole, number>,
    filledSlots: number,
  ): string[] {
    const strengths: string[] = [];

    if (filledSlots === 6) {
      strengths.push('Full six-player draft is ready to evaluate.');
    }

    if (roleCounts.Vanguard >= 1) {
      strengths.push('Has a frontline anchor for space taking and safer engages.');
    }

    if (roleCounts.Strategist >= 2) {
      strengths.push('Has enough support structure to stabilize longer fights.');
    }

    if (roleCounts.Duelist >= 2) {
      strengths.push('Has enough damage threat to convert pressure into eliminations.');
    }

    if (archetype === 'Dive/Pick') {
      strengths.push(
        'Has setup-and-collapse threat: mobile heroes can stage, split attention, and punish isolated targets.',
      );
    }

    if (lean) {
      strengths.push(this.leanStrength(lean));
    }

    return strengths;
  }

  private compRisks(
    lean: HeroBuildType | null,
    archetype: CompArchetype,
    roleCounts: Record<CoreHeroRole, number>,
    filledSlots: number,
  ): string[] {
    const risks: string[] = [];

    if (filledSlots < 6) {
      risks.push('Add all six heroes before trusting the final comp grade.');
    }

    if (roleCounts.Vanguard === 0) {
      risks.push('No Vanguard means the team may struggle to start fights or cross dangerous space.');
    }

    if (roleCounts.Strategist < 2) {
      risks.push('Less than two Strategists can make resets, sustain, and long fights difficult.');
    }

    if (roleCounts.Duelist > 3) {
      risks.push('Too many Duelists can create pressure but may leave the team short on stability.');
    }

    if (archetype === 'Dive/Pick') {
      risks.push(
        'Dive/pick comps are timing-sensitive. If Black Panther, Magik, or other divers enter before attention is split, the comp can look low-damage and stall out.',
      );
    }

    if (lean === 'Ultimate') {
      risks.push(
        'Ultimate comps need patience. Spending key cooldowns early can ruin the fight-winning timing.',
      );
    }

    if (lean === 'Damage') {
      risks.push(
        'Damage-heavy comps must avoid farming stats into tanks instead of forcing useful angles.',
      );
    }

    return risks.length > 0
      ? risks
      : ['No major structural risk detected. The main challenge is execution and cooldown timing.'];
  }

  private leanStrength(type: HeroBuildType): string {
    switch (type) {
      case 'Utility':
        return 'Utility tools can answer enemy win conditions and create cleaner engages.';
      case 'Damage':
        return 'Damage pressure can force mistakes quickly when angles and target focus are disciplined.';
      case 'Sustain':
        return 'Sustain lets the team absorb pressure and win longer resource trades.';
      case 'Mobility':
        return 'Mobility gives the team better rotations, chase routes, exits, and target swaps.';
      case 'Ultimate':
        return 'Ultimate focus gives the team a clear fight-winning conversion plan.';
    }
  }
}
