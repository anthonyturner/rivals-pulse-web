import { ChangeDetectionStrategy, Component, computed, linkedSignal, signal } from '@angular/core';

import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { countLabel } from '../../../shared/utilities/stat-labels';
import { KindChipComponent } from '../../hub/kind-chip/kind-chip.component';
import { MEDIA_TUTORIALS, TUTORIAL_CATEGORIES, TUTORIAL_CATEGORY_KINDS } from './media-tutorials.data';
import { TutorialCardComponent, TutorialCardView } from './tutorial-card/tutorial-card.component';

const ALL_CATEGORIES = 'All';

type TutorialRow = TutorialCardView & { searchText: readonly string[] };

@Component({
  selector: 'app-media-tutorials-page',
  imports: [FilterSelectComponent, KindChipComponent, PageHeaderComponent, StatePanelComponent, TutorialCardComponent],
  templateUrl: './media-tutorials-page.component.html',
  styleUrls: ['../../../shared/styles/guide-article.css', './media-tutorials-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaTutorialsPageComponent {
  protected readonly categoryOptions: readonly FilterOption[] = [ALL_CATEGORIES, ...TUTORIAL_CATEGORIES].map(
    (category) => ({ value: category, label: category }),
  );
  protected readonly category = signal<string>(ALL_CATEGORIES);
  protected readonly searchTerm = signal('');

  private readonly tutorials: readonly TutorialRow[] = MEDIA_TUTORIALS.map((tutorial) => ({
    id: tutorial.id,
    title: tutorial.title,
    description: tutorial.description,
    category: tutorial.category,
    kind: TUTORIAL_CATEGORY_KINDS[tutorial.category],
    topics: `${tutorial.category} · ${tutorial.tags.join(', ')}`,
    youtubeId: tutorial.youtubeId,
    sourceUrl: tutorial.sourceUrl,
    guideUrl: tutorial.guideUrl,
    searchText: [tutorial.title, tutorial.description, ...tutorial.tags],
  }));

  /** The ids of the tutorials whose play button was pressed, so a card that moves keeps its video playing. */
  protected readonly started = signal<ReadonlySet<string>>(new Set());

  private readonly matches = computed(() => {
    const category = this.category();
    const term = this.searchTerm().trim().toLowerCase();

    return this.tutorials.filter(
      (tutorial) =>
        (category === ALL_CATEGORIES || tutorial.category === category) &&
        (term === '' || tutorial.searchText.some((text) => text.toLowerCase().includes(term))),
    );
  });

  /**
   * The lead is the first match that is not playing, so a video playing further down is not moved
   * and restarted. A lead that is playing stays, whatever the filter, so it does not vanish mid-watch.
   */
  private readonly leadId = linkedSignal<readonly TutorialRow[], string | null>({
    source: this.matches,
    computation: (matches, previous) => {
      const started = this.started();

      if (previous?.value && started.has(previous.value)) {
        return previous.value;
      }

      return (matches.find((tutorial) => !started.has(tutorial.id)) ?? matches[0])?.id ?? null;
    },
  });

  protected readonly lead = computed(() => this.tutorials.find((tutorial) => tutorial.id === this.leadId()) ?? null);

  protected readonly noMatches = computed(() => this.matches().length === 0);

  /** The matches besides the lead, grouped by topic in the order the topics are listed. */
  protected readonly groups = computed(() => {
    const rest = this.matches().filter((tutorial) => tutorial.id !== this.leadId());

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

  protected markStarted(id: string): void {
    this.started.update((started) => new Set(started).add(id));
  }
}
