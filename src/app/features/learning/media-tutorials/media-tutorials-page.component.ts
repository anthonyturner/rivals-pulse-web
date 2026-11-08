import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { countLabel } from '../../../shared/utilities/stat-labels';
import { MEDIA_TUTORIALS, TUTORIAL_CATEGORIES, TUTORIAL_CATEGORY_KINDS } from './media-tutorials.data';
import { TutorialCardComponent, TutorialCardView } from './tutorial-card/tutorial-card.component';

const ALL_CATEGORIES = 'All';

/**
 * Every tutorial as a card whose video loads only when played. The first tutorial that matches the
 * filter leads as the featured card, and the rest follow in groups by topic.
 */
@Component({
  selector: 'app-media-tutorials-page',
  imports: [FilterSelectComponent, PageHeaderComponent, StatePanelComponent, TutorialCardComponent],
  templateUrl: './media-tutorials-page.component.html',
  styleUrls: ['../../../shared/styles/guide-article.css', './media-tutorials-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaTutorialsPageComponent {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly categoryOptions: readonly FilterOption[] = [ALL_CATEGORIES, ...TUTORIAL_CATEGORIES].map(
    (category) => ({ value: category, label: category }),
  );
  protected readonly category = signal<string>(ALL_CATEGORIES);
  protected readonly searchTerm = signal('');

  private readonly tutorials: readonly (TutorialCardView & { searchText: readonly string[] })[] = MEDIA_TUTORIALS.map(
    (tutorial) => ({
      id: tutorial.id,
      title: tutorial.title,
      description: tutorial.description,
      category: tutorial.category,
      kind: TUTORIAL_CATEGORY_KINDS[tutorial.category],
      tags: `${tutorial.category} · ${tutorial.tags.join(', ')}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${tutorial.youtubeId}/hqdefault.jpg`,
      // The privacy-enhanced YouTube host. Autoplay, because the player only exists once the visitor pressed play.
      embedUrl: this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube-nocookie.com/embed/${tutorial.youtubeId}?autoplay=1`,
      ),
      sourceUrl: tutorial.sourceUrl,
      guideUrl: tutorial.guideUrl,
      searchText: [tutorial.title, tutorial.description, ...tutorial.tags],
    }),
  );

  private readonly matches = computed(() => {
    const category = this.category();
    const term = this.searchTerm().trim().toLowerCase();

    return this.tutorials.filter(
      (tutorial) =>
        (category === ALL_CATEGORIES || tutorial.category === category) &&
        (term === '' || tutorial.searchText.some((text) => text.toLowerCase().includes(term))),
    );
  });

  protected readonly featured = computed(() => this.matches()[0] ?? null);

  /** The matches after the featured one, grouped by topic in the order the topics are listed. */
  protected readonly groups = computed(() => {
    const rest = this.matches().slice(1);

    return TUTORIAL_CATEGORIES.map((category) => ({
      category,
      kind: TUTORIAL_CATEGORY_KINDS[category],
      tutorials: rest.filter((tutorial) => tutorial.category === category),
    })).filter((group) => group.tutorials.length > 0);
  });

  protected readonly status = computed(() => {
    const total = countLabel(this.tutorials.length, 'tutorial', 'tutorials');
    const shown = this.matches().length;

    return shown === this.tutorials.length ? total : `${shown} of ${total}`;
  });

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
