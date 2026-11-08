import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, Directive, inject, input, TemplateRef } from '@angular/core';

import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import type { RecordsViewState } from '../inject-records-view';
import type { RecordsView } from '../pulse-records-view';
import { RecordsCoverageComponent } from '../records-coverage/records-coverage.component';

interface RecordsContentContext {
  $implicit: RecordsView;
}

/** Marks the `<ng-template>` that draws a Pulse Records page once it has something to show. */
@Directive({ selector: 'ng-template[appRecordsContent]' })
export class RecordsContentDirective {
  readonly template = inject<TemplateRef<RecordsContentContext>>(TemplateRef);

  static ngTemplateContextGuard(_directive: RecordsContentDirective, context: unknown): context is RecordsContentContext {
    return true;
  }
}

/**
 * Everything a Pulse Records page shows under its header: the loading or error panel while there are
 * no numbers, then either the page's own content or the "not enough data yet" panel, and the note on
 * where the records come from.
 */
@Component({
  selector: 'app-records-body',
  imports: [NgTemplateOutlet, RecordsCoverageComponent, StatePanelComponent],
  template: `
    @if (state().failed()) {
      <app-state-panel kind="error" heading="Pulse Records could not be loaded">
        <p>The records are unavailable right now. Try again in a few minutes.</p>
      </app-state-panel>
    } @else if (state().loading()) {
      <app-state-panel kind="loading" heading="Loading Pulse Records" [announce]="false">
        <p>Fetching the best matches.</p>
      </app-state-panel>
    } @else if (loaded(); as context) {
      @if (shown()) {
        <ng-container [ngTemplateOutlet]="content().template" [ngTemplateOutletContext]="context" />
      } @else {
        <app-state-panel heading="Not enough data yet">
          <ng-content />
        </app-state-panel>
      }

      <app-records-coverage />
    }
  `,
  styleUrl: './records-body.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsBodyComponent {
  readonly state = input.required<RecordsViewState>();
  /** Whether the loaded view has anything for this page to show. */
  readonly shown = input.required<boolean>();

  protected readonly content = contentChild.required(RecordsContentDirective);
  /** The content template's context, kept as one object per view so the outlet is not re-rendered on every check. */
  protected readonly loaded = computed((): RecordsContentContext | null => {
    const view = this.state().view();

    return view && { $implicit: view };
  });
}
