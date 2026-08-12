import { Injectable } from '@angular/core';

import { Hero, HeroRole } from '../../heroes/hero.model';

type RoleFilter = HeroRole | 'All';
type ThreatProfile = 'backline' | 'dive' | 'flyer' | 'sniper' | 'summon' | 'tank' | 'general';
type AnswerProfile =
  | 'anti-dive'
  | 'control'
  | 'dive'
  | 'hitscan'
  | 'range'
  | 'sustain'
  | 'tank-breaker'
  | 'general';

const threatProfiles: Record<Exclude<ThreatProfile, 'general' | 'tank'>, string[]> = {
  backline: [
    'Adam Warlock',
    'Cloak & Dagger',
    'Gambit',
    'Invisible Woman',
    'Jeff the Land Shark',
    'Loki',
    'Luna Snow',
    'Mantis',
    'Rocket Raccoon',
    'Ultron',
    'White Fox',
  ],
  dive: [
    'Black Cat',
    'Black Panther',
    'Daredevil',
    'Iron Fist',
    'Magik',
    'Psylocke',
    'Spider-Man',
    'Venom',
    'Wolverine',
  ],
  flyer: ['Angela', 'Human Torch', 'Iron Man', 'Star-Lord', 'Storm'],
  sniper: ['Black Widow', 'Hawkeye', 'Hela', 'The Punisher'],
  summon: ['Groot', 'Namor', 'Peni Parker'],
};

const answerProfiles: Record<Exclude<AnswerProfile, 'general'>, string[]> = {
  'anti-dive': ['Peni Parker', 'Mantis', 'The Thing', 'Groot', 'Ultron'],
  hitscan: ['Black Widow', 'Hawkeye', 'Hela', 'The Punisher'],
  dive: [
    'Black Cat',
    'Black Panther',
    'Daredevil',
    'Iron Fist',
    'Magik',
    'Psylocke',
    'Spider-Man',
    'Venom',
  ],
  sustain: ['Luna Snow', 'Invisible Woman', 'Rocket Raccoon', 'Cloak & Dagger'],
  'tank-breaker': ['Wolverine', 'Hulk'],
  range: ['Doctor Strange', 'Magneto', 'Moon Knight', 'Human Torch', 'Iron Man', 'Storm'],
  control: ['Scarlet Witch', 'Loki'],
};

// Matchup-specific notes backed by Season 9 Diamond+ win-rate data
// (see data/verification/counter-verification-2026-08-03.md).
const specificCounterReasons: Record<string, string> = {
  'Spider-Man|Peni Parker':
    'Peni Parker is Spider-Man’s hardest counter in current data: mines and cyber-webs cover the backline he wants to dive, and every swing-in risks landing on a trap instead of a kill.',
  'Black Panther|Peni Parker':
    'Peni Parker makes the dive path expensive with traps, web zones, and setup control that Black Panther has to cross before reaching the backline.',
  'Black Panther|Mantis':
    'Mantis breaks Black Panther’s reset rhythm: sleep interrupts the dash chain mid-combo and gives her team a free window to delete him.',
  'Wolverine|Hulk':
    'Hulk wins the extended melee brawl — his health pool and sustain outlast Wolverine’s damage window, and current matchup data has Hulk ahead by a wide margin.',
  'Wolverine|Venom':
    'Venom’s bonus-health cycling outlasts Wolverine’s burst window, so Wolverine loses the very brawl he is trying to force.',
  'Moon Knight|Loki':
    'Loki wins this matchup by a huge margin in current data: clones and invisibility scatter Moon Knight’s ankh value, and Loki’s ultimate can turn Moon Knight’s own kit against him.',
  'Mantis|Peni Parker':
    'Peni Parker is currently the only hero with a winning matchup against Mantis: her nest and mine zones apply constant pressure that Mantis cannot sleep or out-heal.',
  'Peni Parker|Daredevil':
    'No hero has a winning matchup against Peni Parker in current high-rank data — Daredevil is the least unfavorable pick, staying mobile and fighting outside her web zones.',
};

@Injectable({ providedIn: 'root' })
export class CounterEngineService {
  filterHeroes(heroes: Hero[], role: RoleFilter, searchTerm: string): Hero[] {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return heroes.filter((hero) => {
      const matchesRole = role === 'All' || hero.role === role || this.heroHasRoleKit(hero, role);
      const matchesSearch =
        !normalizedSearchTerm ||
        hero.name.toLowerCase().includes(normalizedSearchTerm) ||
        hero.counters.some((counter) => counter.toLowerCase().includes(normalizedSearchTerm));

      return matchesRole && matchesSearch;
    });
  }

  matchedCounterHeroes(target: Hero, heroes: Hero[]): Hero[] {
    return target.counters
      .map((counter) => this.findHeroByName(counter, heroes))
      .filter((hero): hero is Hero => Boolean(hero));
  }

  unmatchedCounters(target: Hero, heroes: Hero[]): string[] {
    return target.counters.filter((counter) => !this.findHeroByName(counter, heroes));
  }

  heroesCounteredBy(counterHero: Hero, heroes: Hero[]): Hero[] {
    const counterName = this.normalizeName(counterHero.name);

    return heroes.filter(
      (hero) =>
        hero.id !== counterHero.id &&
        hero.counters.some((counter) => this.normalizeName(counter) === counterName),
    );
  }

  topCounteredHeroes(heroes: Hero[], limit = 6): Hero[] {
    return [...heroes]
      .sort((a, b) => b.counters.length - a.counters.length || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  counterSummary(hero: Hero, heroes: Hero[]): string {
    const matched = hero.counters.filter((counter) => this.findHeroByName(counter, heroes)).length;
    const concepts = Math.max(hero.counters.length - matched, 0);
    const parts = [
      matched ? `${matched} hero picks` : '',
      concepts ? `${concepts} matchup notes` : '',
    ].filter(Boolean);

    return parts.join(' + ') || 'Counter data pending';
  }

  counterReason(target: Hero, counterName: string, heroes: Hero[]): string {
    const counter = this.findHeroByName(counterName, heroes);

    if (!counter) {
      return `${counterName} is a matchup answer because it attacks a key part of ${target.name}'s fight plan.`;
    }

    const targetProfile = this.heroThreatProfile(target);
    const counterProfile = this.heroAnswerProfile(counter);
    const specificReason = specificCounterReasons[`${target.name}|${counter.name}`];

    if (specificReason) {
      return specificReason;
    }

    if (targetProfile === 'dive' && counterProfile === 'anti-dive') {
      return `${counter.name} punishes ${target.name}'s dive timing with area denial, tracking pressure, or peel before the engage can reset.`;
    }

    if (targetProfile === 'dive' && counterProfile === 'range') {
      return `${counter.name} keeps damage on ${target.name} from angles a diver cannot contest mid-engage, draining the health they need to finish combos.`;
    }

    if (targetProfile === 'flyer' && counterProfile === 'hitscan') {
      return `${counter.name} can keep consistent sightline pressure on ${target.name}, forcing them lower, slower, or back to cover.`;
    }

    if (targetProfile === 'tank' && counterProfile === 'tank-breaker') {
      return `${counter.name} pressures ${target.name}'s health pool and makes extended frontline trades harder to survive.`;
    }

    if (targetProfile === 'tank' && counterProfile === 'dive') {
      return `${counter.name} wins the extended brawl inside ${target.name}'s effective range, forcing cooldowns before the frontline can stabilize.`;
    }

    if (targetProfile === 'backline' && counterProfile === 'anti-dive') {
      return `${counter.name} applies constant zone pressure that ${target.name} cannot out-heal or safely reposition around.`;
    }

    if (targetProfile === 'sniper' && counterProfile === 'range') {
      return `${counter.name} attacks from vertical and off-angle positions that ${target.name} cannot hold while also watching the main sightline.`;
    }

    if (targetProfile === 'flyer' && counterProfile === 'range') {
      return `${counter.name} contests ${target.name} in their own airspace, denying the free aerial angle their value depends on.`;
    }

    if (targetProfile === 'summon' && counterProfile === 'dive') {
      return `${counter.name} engages before ${target.name}'s setup completes, fighting around the zone instead of feeding into it.`;
    }

    if (targetProfile === 'backline' && counterProfile === 'dive') {
      return `${counter.name} can reach ${target.name}'s position quickly, force defensive cooldowns, and break their safe support rhythm.`;
    }

    if (targetProfile === 'sniper' && counterProfile === 'dive') {
      return `${counter.name} closes distance quickly, denies comfortable sightlines, and turns ${target.name}'s range advantage into a scramble.`;
    }

    if (targetProfile === 'summon' && counterProfile === 'range') {
      return `${counter.name} can clear or pressure ${target.name}'s setup from safer angles before the zone takes over the fight.`;
    }

    if (counterProfile === 'control') {
      return `${counter.name} interrupts ${target.name}'s preferred timing with crowd control, zoning, or forced repositioning.`;
    }

    if (counterProfile === 'sustain') {
      return `${counter.name} helps the team live through ${target.name}'s burst window, denying the quick pick they need.`;
    }

    return `${counter.name} counters ${target.name} by challenging their preferred range, timing, or cooldown cycle.`;
  }

  private findHeroByName(name: string, heroes: Hero[]): Hero | undefined {
    const normalized = this.normalizeName(name);

    return heroes.find((hero) => this.normalizeName(hero.name) === normalized);
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private heroHasRoleKit(hero: Hero, role: RoleFilter): boolean {
    return role !== 'All' && Boolean(hero.roleAbilityKits?.some((kit) => kit.role === role));
  }

  private heroThreatProfile(hero: Hero): ThreatProfile {
    for (const [profile, heroNames] of Object.entries(threatProfiles)) {
      if (heroNames.includes(hero.name)) {
        return profile as ThreatProfile;
      }
    }

    if (hero.role === 'Vanguard') {
      return 'tank';
    }

    return 'general';
  }

  private heroAnswerProfile(hero: Hero): AnswerProfile {
    for (const [profile, heroNames] of Object.entries(answerProfiles)) {
      if (heroNames.includes(hero.name)) {
        return profile as AnswerProfile;
      }
    }

    return 'general';
  }
}
