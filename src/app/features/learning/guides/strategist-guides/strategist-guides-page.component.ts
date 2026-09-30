import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  STRATEGIST_GUIDES,
  STRATEGIST_PLAYLIST_URL,
  StrategistGuideCategory,
} from './strategist-guides.data';

type GuideFilter = 'All' | StrategistGuideCategory;

@Component({
  selector: 'app-strategist-guides-page',
  imports: [RouterLink],
  templateUrl: './strategist-guides-page.component.html',
  styleUrl: './strategist-guides-page.component.css',
})
export class StrategistGuidesPageComponent {
  readonly guides = STRATEGIST_GUIDES;
  readonly playlistUrl = STRATEGIST_PLAYLIST_URL;
  readonly filters: GuideFilter[] = [
    'All',
    'Fundamentals',
    'Ultimate Economy',
    'Rocket Raccoon',
    'Positioning',
    'Decision Making',
  ];
  readonly selectedFilter = signal<GuideFilter>('All');
  readonly searchTerm = signal('');

  readonly filteredGuides = computed(() => {
    const filter = this.selectedFilter();
    const query = this.searchTerm().trim().toLowerCase();

    return this.guides.filter((guide) => {
      const matchesFilter = filter === 'All' || guide.category === filter;
      const searchable = [
        guide.title,
        guide.heroFocus,
        guide.category,
        guide.summary,
        ...guide.principles.map((principle) => principle.title),
      ]
        .join(' ')
        .toLowerCase();

      return matchesFilter && (query.length === 0 || searchable.includes(query));
    });
  });

  selectFilter(filter: GuideFilter): void {
    this.selectedFilter.set(filter);
  }

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
