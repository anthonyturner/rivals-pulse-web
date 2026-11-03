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

  private readonly isDark = computed(() => this.themeService.theme() === 'dark');

  /** Names the theme a click switches to, not the one showing. */
  protected readonly label = computed(() => (this.isDark() ? 'Switch to light theme' : 'Switch to dark theme'));

  protected readonly icon = computed(() => (this.isDark() ? '\u2600\uFE0F' : '\uD83C\uDF19'));

  protected toggle(): void {
    this.themeService.toggleTheme();
  }
}
