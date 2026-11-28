import { ChangeDetectionStrategy, Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import type { FilterOption } from '../../../../shared/components/filter-select/filter-select.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { GuideCardComponent } from '../guide-card/guide-card.component';
import { GUIDE_CATEGORIES, GUIDE_HEROES, LIBRARY_GUIDES, findLibraryGuides, groupLibraryGuides } from './guide-library.data';

@Component({
  selector: 'app-hero-guides-page',
  imports: [FilterSelectComponent, GuideCardComponent, PageHeaderComponent, RouterLink, StatePanelComponent],
  templateUrl: './hero-guides-page.component.html',
  styleUrl: './hero-guides-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGuidesPageComponent {
  readonly categoryOptions: readonly FilterOption[] = [
    { value: '', label: 'All categories' },
    ...GUIDE_CATEGORIES.map((category) => ({ value: category, label: category })),
  ];
  readonly heroOptions: readonly FilterOption[] = [
    { value: '', label: 'All heroes' },
    ...GUIDE_HEROES.map((hero) => ({ value: hero, label: hero })),
  ];
  readonly searchTerm = signal('');
  readonly category = signal('');
  readonly hero = signal('');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  readonly guides = computed(() => findLibraryGuides(this.searchTerm(), this.category(), this.hero()));
  readonly sections = computed(() => groupLibraryGuides(this.guides()));
  readonly filtersActive = computed(() => this.searchTerm() !== '' || this.category() !== '' || this.hero() !== '');
  readonly status = computed(() => {
    const total = `${LIBRARY_GUIDES.length} guides`;

    return this.guides().length === LIBRARY_GUIDES.length ? total : `${this.guides().length} of ${total}`;
  });

  updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchTerm.set(event.target.value);
    }
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.category.set('');
    this.hero.set('');
    this.searchInput().nativeElement.focus();
  }
}
