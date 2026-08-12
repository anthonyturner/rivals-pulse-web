import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HeroUsageSectionComponent } from '../sections/hero-usage-section/hero-usage-section.component';
import { HighlightCardsSectionComponent } from '../sections/highlight-cards-section/highlight-cards-section.component';
import { SeasonUpdatesSectionComponent } from '../sections/season-updates-section/season-updates-section.component';
import {
  SeasonDashboardService,
  type SeasonDashboardState,
} from './season-dashboard.service';

@Component({
  selector: 'app-season-dashboard',
  imports: [
    HeroUsageSectionComponent,
    HighlightCardsSectionComponent,
    SeasonUpdatesSectionComponent,
  ],
  templateUrl: './season-dashboard.component.html',
  styleUrl: './season-dashboard.component.css',
})
export class SeasonDashboardComponent {
  private readonly service = inject(SeasonDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = signal<SeasonDashboardState>(this.service.initialState);

  constructor() {
    if (this.isBrowser) {
      this.service.getSeasonDashboard()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((state) => {
          this.state.set(state);
        });
    }
  }
}
