import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { TileChipKind } from '../hub-tile.types';

/**
 * A small pill tinted by kind: the accent (yellow), the secondary (indigo) or the tertiary (violet).
 * `size` is `large` for a pill that stands as a heading. `dark` is for a pill on a dark panel, which
 * stays dark in both themes: only the accent kind is yellow there, since the tinted colours are not
 * made for a dark fill. The host is the pill, and carries the `chip` class, so the card around it can
 * place it.
 */
@Component({
  selector: 'app-kind-chip',
  template: '{{ label() }}',
  styleUrl: './kind-chip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'chip',
    '[attr.data-kind]': 'kind()',
    '[attr.data-size]': 'size()',
    '[attr.data-dark]': 'dark() ? "" : null',
  },
})
export class KindChipComponent {
  readonly kind = input.required<TileChipKind>();
  readonly label = input.required<string>();
  readonly size = input<'small' | 'large'>('small');
  readonly dark = input(false);
}
