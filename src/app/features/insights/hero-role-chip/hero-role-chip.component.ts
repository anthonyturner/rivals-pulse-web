import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A hero's role as a small pill. It reads `--tile-role-color` and `--tile-role-ink`, which an art-led
 * `app-hero-tile` sets for its hero's role, so it belongs inside such a tile's content and takes its
 * tint from the one role-to-colour mapping there.
 */
@Component({
  selector: 'app-hero-role-chip',
  template: '{{ role() }}',
  styleUrl: './hero-role-chip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'role-chip' },
})
export class HeroRoleChipComponent {
  readonly role = input.required<string>();
}
