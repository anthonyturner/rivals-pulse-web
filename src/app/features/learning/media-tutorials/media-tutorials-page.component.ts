import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { countLabel } from '../../../shared/utilities/stat-labels';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';
import { MEDIA_TUTORIALS, TUTORIAL_CATEGORIES } from './media-tutorials.data';

const ALL_CATEGORIES = 'All';

@Component({
  selector: 'app-media-tutorials-page',
  imports: [FilterSelectComponent, HeroTileComponent, PageHeaderComponent, RouterLink, StatePanelComponent],
  templateUrl: './media-tutorials-page.component.html',
  styleUrl: './media-tutorials-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaTutorialsPageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly playerTitle = viewChild.required<ElementRef<HTMLElement>>('playerTitle');

  protected readonly categoryOptions: readonly FilterOption[] = [ALL_CATEGORIES, ...TUTORIAL_CATEGORIES].map(
    (category) => ({ value: category, label: category }),
  );
  protected readonly category = signal<string>(ALL_CATEGORIES);
  protected readonly searchTerm = signal('');

  private readonly tutorials = MEDIA_TUTORIALS.map((tutorial) => ({
    ...tutorial,
    topics: `${tutorial.category} · ${tutorial.tags.join(', ')}`,
    embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${tutorial.youtubeId}`),
  }));

  private readonly selectedId = signal(this.tutorials[0].id);

  /** The tutorial in the player. Filtering never changes it, so the video does not vanish mid-watch. */
  protected readonly current = computed(
    () => this.tutorials.find((tutorial) => tutorial.id === this.selectedId()) ?? this.tutorials[0],
  );

  protected readonly rows = computed(() => {
    const category = this.category();
    const term = this.searchTerm().trim().toLowerCase();

    return this.tutorials.filter(
      (tutorial) =>
        (category === ALL_CATEGORIES || tutorial.category === category) &&
        (term === '' ||
          [tutorial.title, tutorial.description, ...tutorial.tags].some((text) => text.toLowerCase().includes(term))),
    );
  });

  protected readonly status = computed(() => {
    const total = countLabel(this.tutorials.length, 'tutorial', 'tutorials');
    const shown = this.rows().length;

    return shown === this.tutorials.length ? total : `${shown} of ${total}`;
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  /** Swaps the video and moves focus to its title, which is what a screen reader hears change. */
  protected select(id: string): void {
    this.selectedId.set(id);
    this.playerTitle().nativeElement.focus();
  }
}
