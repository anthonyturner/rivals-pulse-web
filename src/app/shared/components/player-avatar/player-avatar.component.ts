import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A player's Overwolf avatar as a small circle, or the first letter of their name when there is no
 * avatar or it does not load (the server only stores addresses on an allowed host, but not every
 * stored address is guaranteed to resolve). The picture is decoration: the name is always written
 * out beside it, so it carries no alt text. Size comes from `--player-avatar-size`.
 */
@Component({
  selector: 'app-player-avatar',
  templateUrl: './player-avatar.component.html',
  styleUrl: './player-avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerAvatarComponent {
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);

  private readonly failedUrl = signal<string | null>(null);

  protected readonly source = computed(() => {
    const url = this.avatarUrl();

    return url !== null && url !== this.failedUrl() ? url : null;
  });

  protected readonly initial = computed(() => Array.from(this.name().trim())[0]?.toUpperCase() ?? '?');

  protected showInitial(): void {
    this.failedUrl.set(this.avatarUrl());
  }
}
