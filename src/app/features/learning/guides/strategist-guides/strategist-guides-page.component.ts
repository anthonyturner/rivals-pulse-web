import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FilterOption, FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { GuideCardComponent } from '../guide-card/guide-card.component';
import { STRATEGIST_GUIDES, STRATEGIST_PLAYLIST_URL } from './strategist-guides.data';

const ALL_CATEGORIES = 'All';

@Component({
  selector: 'app-strategist-guides-page',
  imports: [FilterSelectComponent, GuideCardComponent, RouterLink, StatePanelComponent],
  templateUrl: './strategist-guides-page.component.html',
  styleUrl: './strategist-guides-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategistGuidesPageComponent {
  readonly playlistUrl = STRATEGIST_PLAYLIST_URL;
  readonly categoryOptions: readonly FilterOption[] = [
    { value: ALL_CATEGORIES, label: 'All categories' },
    ...[...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))].map((category) => ({
      value: category,
      label: category,
    })),
  ];
  readonly category = signal(ALL_CATEGORIES);
  readonly searchTerm = signal('');

  readonly cards = computed(() => {
    const category = this.category();
    const query = this.searchTerm().trim().toLowerCase();

    return STRATEGIST_GUIDES.filter((guide) => {
      const searchable = [
        guide.title,
        guide.heroFocus,
        guide.category,
        guide.summary,
        ...guide.principles.map((principle) => principle.title),
      ]
        .join(' ')
        .toLowerCase();

      return (category === ALL_CATEGORIES || guide.category === category) && searchable.includes(query);
    }).map((guide) => ({
      id: guide.id,
      title: guide.shortTitle,
      route: ['/strategist-guides', guide.id],
      imageUrl: guide.heroImage,
      caption: `${guide.category} · ${guide.heroFocus} · ${guide.duration}`,
      blurb: guide.summary,
    }));
  });

  readonly countLabel = computed(() => {
    const shown = this.cards().length;
    const total = STRATEGIST_GUIDES.length;

    return shown === total ? `${total} guides` : `${shown} of ${total} guides`;
  });

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.category.set(ALL_CATEGORIES);
  }
}
