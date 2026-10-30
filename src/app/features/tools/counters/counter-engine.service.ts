import { Injectable } from '@angular/core';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { Hero, HeroRole } from '../../heroes/hero.model';
import {
  hasWinningRecord,
  matchupCountOf,
  recordCards,
  type RecordCard,
  winningRecordsAgainst,
  winningRecordsOf,
} from '../../insights/hero-matchup-records';

type RoleFilter = HeroRole | 'All';

/** A hero with a winning record against at least one of the chosen enemy heroes. */
export interface MultiThreatAnswer {
  hero: Hero;
  coveredThreats: Hero[];
}

/**
 * Every counter read on the Hero Counters page comes from recorded matchups: who has a winning record
 * against a hero, and who that hero has one against. Nothing here is hand-authored or ranks a hero
 * to ban.
 */
@Injectable({ providedIn: 'root' })
export class CounterEngineService {
  filterHeroes(heroes: Hero[], role: RoleFilter, searchTerm: string): Hero[] {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return heroes.filter((hero) => {
      const matchesRole = role === 'All' || hero.role === role || this.heroHasRoleKit(hero, role);
      const matchesSearch = !normalizedSearchTerm || hero.name.toLowerCase().includes(normalizedSearchTerm);

      return matchesRole && matchesSearch;
    });
  }

  /** Heroes with a winning record against `target`, best record first. */
  winningAgainst(target: Hero, heroes: Hero[], matchups: HeroMatchups): RecordCard<Hero>[] {
    return recordCards(winningRecordsAgainst(matchups, target.id), 'hero', heroes);
  }

  /** Heroes `target` has a winning record against, best record first. */
  winningFor(target: Hero, heroes: Hero[], matchups: HeroMatchups): RecordCard<Hero>[] {
    return recordCards(winningRecordsOf(matchups, target.id), 'enemy', heroes);
  }

  /** "3 matchups", or "No matchup yet" when no record of the hero is large enough to show. */
  matchupCountLabel(hero: Hero, matchups: HeroMatchups | null | undefined): string {
    const count = matchups ? matchupCountOf(matchups, hero.id) : 0;

    return count === 0 ? 'No matchup yet' : `${count} matchup${count === 1 ? '' : 's'}`;
  }

  /**
   * The heroes with a winning record against the most of the chosen enemy heroes. A hero is never
   * its own answer, and one with no winning record against any of them is left out.
   */
  answersTo(threats: Hero[], heroes: Hero[], matchups: HeroMatchups, limit = 6): MultiThreatAnswer[] {
    if (!threats.length) {
      return [];
    }

    return heroes
      .filter((candidate) => !threats.some((threat) => threat.id === candidate.id))
      .map((candidate) => ({
        hero: candidate,
        coveredThreats: threats.filter((threat) =>
          matchups.matchups.some(
            (matchup) => matchup.hero === candidate.id && matchup.enemy === threat.id && hasWinningRecord(matchup),
          ),
        ),
      }))
      .filter((answer) => answer.coveredThreats.length > 0)
      .sort(
        (a, b) =>
          b.coveredThreats.length - a.coveredThreats.length ||
          this.rolePriority(a.hero.role) - this.rolePriority(b.hero.role) ||
          a.hero.name.localeCompare(b.hero.name),
      )
      .slice(0, limit);
  }

  private rolePriority(role: HeroRole): number {
    return role === 'Vanguard' ? 0 : role === 'Duelist' ? 1 : 2;
  }

  private heroHasRoleKit(hero: Hero, role: RoleFilter): boolean {
    return role !== 'All' && Boolean(hero.roleAbilityKits?.some((kit) => kit.role === role));
  }
}
