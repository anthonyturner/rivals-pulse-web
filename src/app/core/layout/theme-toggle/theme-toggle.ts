import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ThemeService } from '../../theme/theme.service';

/** The header button that flips the site between its dark and light themes. */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  private readonly themeService = inject(ThemeService);

  /** Names the theme a click switches to, not the one showing. */
  protected readonly label = computed(() =>
    this.themeService.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );

  protected toggle(): void {
    this.themeService.toggleTheme();
  }
}
