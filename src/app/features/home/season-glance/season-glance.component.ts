import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SeasonGlanceService, type SeasonGlanceState } from './season-glance.service';

@Component({
  selector: 'app-season-glance',
  templateUrl: './season-glance.component.html',
  styleUrl: './season-glance.component.css',
})
export class SeasonGlanceComponent {
  private readonly service = inject(SeasonGlanceService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = signal<SeasonGlanceState>(this.service.initialState);

  constructor() {
    if (this.isBrowser) {
      this.service.getSeasonGlance()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((state) => {
          this.state.set(state);
        });
    }
  }
}
