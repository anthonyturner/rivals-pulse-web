import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Where a search lands. The heroes page owns the roster filter, so a term is
 * handed to it as a query parameter rather than duplicating the filtering here.
 */
export const HERO_SEARCH_ROUTE = '/heroes';
export const HERO_SEARCH_PARAM = 'q';

export const POPULAR_SEARCHES: readonly string[] = [
  'Hela counters',
  'Gorr guide',
  'S tier',
  'Triple support',
];

@Component({
  selector: 'app-hero-search',
  templateUrl: './hero-search.component.html',
  styleUrl: './hero-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSearchComponent {
  private readonly router = inject(Router);

  readonly popularSearches = POPULAR_SEARCHES;
  readonly term = signal('');

  onTermInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.search(this.term());
  }

  onPopularSearch(term: string): void {
    this.term.set(term);
    this.search(term);
  }

  private search(rawTerm: string): void {
    const term = rawTerm.trim();

    // An empty search still opens the roster, just unfiltered.
    void this.router.navigate([HERO_SEARCH_ROUTE], {
      queryParams: term ? { [HERO_SEARCH_PARAM]: term } : {},
    });
  }
}
