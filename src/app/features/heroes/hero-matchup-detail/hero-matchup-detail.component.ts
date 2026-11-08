import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

import type { HeadToHeadView } from './hero-matchup-detail-view';

/** The head-to-head between two heroes, in a modal dialog that is open while it has a view to show. */
@Component({
  selector: 'app-hero-matchup-detail',
  templateUrl: './hero-matchup-detail.component.html',
  styleUrl: './hero-matchup-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroMatchupDetailComponent {
  /** Null keeps the dialog closed. */
  readonly view = input<HeadToHeadView | null>(null);
  /** Fires once the dialog has closed, by its button, Escape or a click on the backdrop. */
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;

      if (this.view() === null) {
        if (dialog.open) {
          dialog.close();
        }
      } else if (!dialog.open) {
        dialog.showModal();
      }
    });
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Where the last press started, so a text selection dragged out of the panel does not close it. */
  protected pressedOn: EventTarget | null = null;

  /** A click pressed and released on the dialog itself landed on the backdrop, outside the panel. */
  protected closeFromBackdrop(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;

    if (event.target === dialog && this.pressedOn === dialog) {
      this.close();
    }
  }
}
