import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { GlossaryDataService } from '../../reference/glossary/glossary-data.service';
import type { GlossaryTerm } from '../../reference/glossary/glossary.model';
import { LOCAL_DATE } from '../../../shared/utilities/local-date';
import { selectWordOfDay } from '../../reference/glossary/word-of-day-term';

@Component({
  selector: 'app-word-of-day',
  imports: [RouterLink],
  templateUrl: './word-of-day.component.html',
  styleUrl: './word-of-day.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordOfDayComponent {
  private readonly glossaryData = inject(GlossaryDataService);
  private readonly localDate = inject(LOCAL_DATE);
  readonly dismissed = signal(false);
  readonly term = toSignal(
    this.glossaryData.getTerms().pipe(
      map((terms: GlossaryTerm[]) => selectWordOfDay(terms, this.localDate())),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );

  dismiss(): void {
    this.dismissed.set(true);
  }
}
