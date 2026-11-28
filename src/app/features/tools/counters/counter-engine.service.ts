import { Injectable } from '@angular/core';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { Hero, HeroRole } from '../../heroes/hero.model';
import {
  matchupCountOf,
  recordCards,
  type RecordCard,
  winningRecordsAgainst,
  winningRecordsOf,
} from '../../insights/hero-matchup-records';

type RoleFilter = HeroRole | 'All';

/**
 * Every counter read on the Hero Counters page comes from recorded matchups: who does better than
 * usual against a hero, and whom that hero does better than usual against. Nothing here is hand-authored or ranks a hero
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

  /** Heroes that do better than usual against `target`, by the community counter rule. */
  winningAgainst(target: Hero, heroes: Hero[], matchups: HeroMatchups): RecordCard<Hero>[] {
    return recordCards(winningRecordsAgainst(matchups, target.id), 'hero', heroes);
  }

  /** Heroes `target` does better than usual against, by the community counter rule. */
  winningFor(target: Hero, heroes: Hero[], matchups: HeroMatchups): RecordCard<Hero>[] {
    return recordCards(winningRecordsOf(matchups, target.id), 'enemy', heroes);
  }

  /**
   * "3 matchups", or "No matchup yet" when no record of the hero is large enough to show. While the
   * matchups load, or when they could not be read, it says so instead: that is not "no matchup".
   */
  matchupCountLabel(hero: Hero, matchups: HeroMatchups | null | undefined): string {
    if (matchups === undefined) {
      return 'Loading';
    }

    if (matchups === null) {
      return 'Unavailable';
    }

    const count = matchupCountOf(matchups, hero.id);

    return count === 0 ? 'No matchup yet' : `${count} matchup${count === 1 ? '' : 's'}`;
  }

  private heroHasRoleKit(hero: Hero, role: RoleFilter): boolean {
    return role !== 'All' && Boolean(hero.roleAbilityKits?.some((kit) => kit.role === role));
  }
}
