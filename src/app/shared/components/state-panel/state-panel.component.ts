import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The panel a page shows in place of its numbers.
 *
 * - `loading`: announced politely and marked busy.
 * - `error`: announced politely.
 * - `empty`: not announced, because the page already says what it is about.
 *
 * Set `announce` to false when another panel on the page already says the same thing.
 *
 * Its body is the content passed in. The heading is optional, and its level is the page's to choose
 * so the heading order does not skip.
 */
@Component({
  selector: 'app-state-panel',
  template: `
    <div class="body">
      @if (heading(); as text) {
        @switch (headingLevel()) {
          @case (3) {
            <h3 class="heading">{{ text }}</h3>
          }
          @default {
            <h2 class="heading">{{ text }}</h2>
          }
        }
      }
      <ng-content />
    </div>
  `,
  styleUrl: './state-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'announced() ? "status" : null',
    '[attr.aria-busy]': 'kind() === "loading" ? "true" : null',
  },
})
export class StatePanelComponent {
  readonly kind = input<'loading' | 'error' | 'empty'>('empty');
  readonly heading = input<string | null>(null);
  readonly headingLevel = input<2 | 3>(2);
  readonly announce = input(true);

  protected readonly announced = computed(() => this.announce() && this.kind() !== 'empty');
}
