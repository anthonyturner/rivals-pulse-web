import { ChangeDetectionStrategy, Component, ElementRef, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FilterOption, FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { GuideChaptersComponent } from '../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../shared/components/guide-chapters/guide-chapters.types';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { TechniqueTile, TechniqueTileComponent } from './technique-tile/technique-tile.component';
import {
  FIGHT_FLOW_STEPS,
  HERO_WORKSHOPS,
  ROLE_LIBRARY,
  TECHNIQUE_CATEGORIES,
  TECHNIQUE_GUIDES,
} from './techniques.data';

const ALL_CATEGORIES = 'All';

@Component({
  selector: 'app-techniques-page',
  imports: [FilterSelectComponent, GuideChaptersComponent, RouterLink, StatePanelComponent, TechniqueTileComponent],
  templateUrl: './techniques-page.component.html',
  styleUrls: ['../../../../shared/styles/guide-article.css', '../../../../shared/styles/field-guide.css', './techniques-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechniquesPageComponent {
  readonly chapters: readonly GuideChapter[] = [
    { id: 'choose-a-focus', title: 'Choose a focus' },
    { id: 'technique-library', title: 'Technique lessons' },
    { id: 'fight-flow', title: 'How a fight flows' },
    { id: 'hero-workshops', title: 'Hero workshops' },
    { id: 'role-coverage', title: 'Workbook coverage' },
    { id: 'next-match', title: 'Review one decision' },
  ];
  readonly categoryOptions: readonly FilterOption[] = [
    { value: ALL_CATEGORIES, label: ALL_CATEGORIES },
    ...TECHNIQUE_CATEGORIES.map((category) => ({ value: category, label: category })),
  ];
  readonly fightFlow = FIGHT_FLOW_STEPS;
  readonly roles = ROLE_LIBRARY.map(({ role, heroes }) => ({ role, heroes: heroes.join(', ') }));
  readonly workshops: readonly TechniqueTile[] = HERO_WORKSHOPS.map((workshop) => ({
    title: workshop.hero,
    image: workshop.image,
    caption: workshop.role,
    body: workshop.focus,
    practice: null,
    tags: null,
    links: workshop.links,
  }));

  readonly category = signal(ALL_CATEGORIES);
  readonly searchTerm = signal('');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');

  readonly tiles = computed<TechniqueTile[]>(() => {
    const category = this.category();
    const query = this.searchTerm().trim().toLowerCase();

    return TECHNIQUE_GUIDES.filter((guide) => {
      const searchable = [guide.title, guide.takeaway, guide.practice, ...guide.tags].join(' ').toLowerCase();

      return (category === ALL_CATEGORIES || guide.category === category) && searchable.includes(query);
    }).map((guide) => ({
      title: guide.title,
      image: guide.image,
      caption: category === ALL_CATEGORIES ? guide.category : null,
      body: guide.takeaway,
      practice: guide.practice,
      tags: guide.tags.join(' · '),
      links: guide.links,
    }));
  });

  readonly countLabel = computed(() => {
    const shown = this.tiles().length;
    const total = TECHNIQUE_GUIDES.length;

    if (shown === 0) {
      return 'No guides match';
    }

    return shown === total ? `${total} guides` : `${shown} of ${total} guides`;
  });

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.category.set(ALL_CATEGORIES);
    // The button that was pressed leaves with the empty-state panel, so focus would drop to the page.
    this.searchInput().nativeElement.focus();
  }
}
